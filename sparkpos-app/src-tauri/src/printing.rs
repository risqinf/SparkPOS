//! Pencetakan langsung (tanpa dialog) untuk SparkPOS.
//!
//! - `list_printers`      : daftar printer terpasang di OS + penanda printer default.
//! - `print_raw`          : kirim byte mentah (ESC/POS) ke printer thermal berdasarkan nama.
//! - `get_default_printer` / `set_default_printer`
//!                        : dipakai untuk cetak A4 senyap (WebView2 `--kiosk-printing`
//!                          selalu mencetak ke printer default Windows).
//!
//! Windows memakai API winspool secara langsung; macOS/Linux (mode dev) memakai CUPS (`lp`, `lpstat`).

use serde::Serialize;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PrinterInfo {
  pub name: String,
  pub is_default: bool,
}

#[tauri::command]
pub fn list_printers() -> Result<Vec<PrinterInfo>, String> {
  platform::list_printers()
}

#[tauri::command]
pub fn print_raw(printer: String, data: Vec<u8>) -> Result<(), String> {
  if printer.trim().is_empty() {
    return Err("Nama printer kosong".into());
  }
  if data.is_empty() {
    return Err("Data cetak kosong".into());
  }
  platform::print_raw(&printer, &data)
}

#[tauri::command]
pub fn get_default_printer() -> Option<String> {
  platform::default_printer()
}

#[tauri::command]
pub fn set_default_printer(name: String) -> Result<(), String> {
  platform::set_default_printer(&name)
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------
#[cfg(windows)]
mod platform {
  use super::PrinterInfo;
  use std::ffi::c_void;
  use std::ptr;
  use windows_sys::Win32::Foundation::GetLastError;
  use windows_sys::Win32::Graphics::Printing::{
    ClosePrinter, EndDocPrinter, EndPagePrinter, EnumPrintersW, GetDefaultPrinterW, OpenPrinterW,
    SetDefaultPrinterW, StartDocPrinterW, StartPagePrinter, WritePrinter, DOC_INFO_1W,
    PRINTER_ENUM_CONNECTIONS, PRINTER_ENUM_LOCAL, PRINTER_HANDLE, PRINTER_INFO_4W,
  };

  fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
  }

  fn from_wide_ptr(p: *const u16) -> String {
    if p.is_null() {
      return String::new();
    }
    unsafe {
      let mut len = 0usize;
      while *p.add(len) != 0 {
        len += 1;
      }
      String::from_utf16_lossy(std::slice::from_raw_parts(p, len))
    }
  }

  pub fn default_printer() -> Option<String> {
    unsafe {
      let mut len: u32 = 0;
      GetDefaultPrinterW(ptr::null_mut(), &mut len);
      if len == 0 {
        return None;
      }
      let mut buf = vec![0u16; len as usize];
      if GetDefaultPrinterW(buf.as_mut_ptr(), &mut len) == 0 {
        return None;
      }
      let name = from_wide_ptr(buf.as_ptr());
      if name.is_empty() {
        None
      } else {
        Some(name)
      }
    }
  }

  pub fn set_default_printer(name: &str) -> Result<(), String> {
    let w = wide(name);
    let ok = unsafe { SetDefaultPrinterW(w.as_ptr()) };
    if ok == 0 {
      Err(format!("Gagal mengatur printer default (kode {})", unsafe { GetLastError() }))
    } else {
      Ok(())
    }
  }

  pub fn list_printers() -> Result<Vec<PrinterInfo>, String> {
    let default = default_printer();
    let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
    unsafe {
      let mut needed: u32 = 0;
      let mut returned: u32 = 0;
      EnumPrintersW(flags, ptr::null(), 4, ptr::null_mut(), 0, &mut needed, &mut returned);
      if needed == 0 {
        return Ok(Vec::new());
      }
      let mut buf = vec![0u8; needed as usize];
      let ok = EnumPrintersW(
        flags,
        ptr::null(),
        4,
        buf.as_mut_ptr(),
        needed,
        &mut needed,
        &mut returned,
      );
      if ok == 0 {
        return Err(format!("Gagal membaca daftar printer (kode {})", GetLastError()));
      }
      let base = buf.as_ptr() as *const PRINTER_INFO_4W;
      let mut list = Vec::with_capacity(returned as usize);
      for i in 0..returned as usize {
        let info = ptr::read_unaligned(base.add(i));
        let name = from_wide_ptr(info.pPrinterName as *const u16);
        if name.is_empty() {
          continue;
        }
        let is_default = default.as_deref() == Some(name.as_str());
        list.push(PrinterInfo { name, is_default });
      }
      Ok(list)
    }
  }

  pub fn print_raw(printer: &str, data: &[u8]) -> Result<(), String> {
    unsafe {
      let name = wide(printer);
      let mut handle: PRINTER_HANDLE = std::mem::zeroed();
      if OpenPrinterW(name.as_ptr(), &mut handle, ptr::null()) == 0 {
        return Err(format!(
          "Printer \"{}\" tidak bisa dibuka (kode {}). Pastikan printer menyala & terpasang.",
          printer,
          GetLastError()
        ));
      }

      let mut doc_name = wide("SparkPOS");
      let mut datatype = wide("RAW");
      let doc = DOC_INFO_1W {
        pDocName: doc_name.as_mut_ptr(),
        pOutputFile: ptr::null_mut(),
        pDatatype: datatype.as_mut_ptr(),
      };

      let job = StartDocPrinterW(handle, 1, &doc as *const DOC_INFO_1W as *const u8);
      if job == 0 {
        let code = GetLastError();
        ClosePrinter(handle);
        return Err(format!("Gagal memulai dokumen cetak (kode {})", code));
      }

      let mut result: Result<(), String> = Ok(());
      if StartPagePrinter(handle) == 0 {
        result = Err(format!("Gagal memulai halaman cetak (kode {})", GetLastError()));
      } else {
        let mut offset = 0usize;
        while offset < data.len() {
          let chunk = &data[offset..];
          let mut written: u32 = 0;
          let ok = WritePrinter(
            handle,
            chunk.as_ptr() as *const c_void,
            chunk.len() as u32,
            &mut written,
          );
          if ok == 0 || written == 0 {
            result = Err(format!("Gagal mengirim data ke printer (kode {})", GetLastError()));
            break;
          }
          offset += written as usize;
        }
        EndPagePrinter(handle);
      }

      EndDocPrinter(handle);
      ClosePrinter(handle);
      result
    }
  }
}

// ---------------------------------------------------------------------------
// macOS / Linux (CUPS) - dipakai saat pengembangan
// ---------------------------------------------------------------------------
#[cfg(not(windows))]
mod platform {
  use super::PrinterInfo;
  use std::io::Write;
  use std::process::{Command, Stdio};

  pub fn default_printer() -> Option<String> {
    let out = Command::new("lpstat").arg("-d").output().ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    text
      .split(':')
      .nth(1)
      .map(|s| s.trim().to_string())
      .filter(|s| !s.is_empty() && !s.contains("no system default"))
  }

  pub fn set_default_printer(name: &str) -> Result<(), String> {
    let status = Command::new("lpoptions")
      .args(["-d", name])
      .status()
      .map_err(|e| format!("lpoptions tidak tersedia: {e}"))?;
    if status.success() {
      Ok(())
    } else {
      Err("Gagal mengatur printer default".into())
    }
  }

  pub fn list_printers() -> Result<Vec<PrinterInfo>, String> {
    let default = default_printer();
    let out = Command::new("lpstat")
      .arg("-e")
      .output()
      .map_err(|e| format!("lpstat tidak tersedia (CUPS belum terpasang): {e}"))?;
    let text = String::from_utf8_lossy(&out.stdout);
    Ok(
      text
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .map(|name| PrinterInfo {
          name: name.to_string(),
          is_default: default.as_deref() == Some(name),
        })
        .collect(),
    )
  }

  pub fn print_raw(printer: &str, data: &[u8]) -> Result<(), String> {
    let mut child = Command::new("lp")
      .args(["-d", printer, "-o", "raw"])
      .stdin(Stdio::piped())
      .stdout(Stdio::null())
      .stderr(Stdio::piped())
      .spawn()
      .map_err(|e| format!("Perintah lp tidak tersedia: {e}"))?;
    if let Some(stdin) = child.stdin.as_mut() {
      stdin.write_all(data).map_err(|e| format!("Gagal mengirim data: {e}"))?;
    }
    let out = child.wait_with_output().map_err(|e| e.to_string())?;
    if out.status.success() {
      Ok(())
    } else {
      Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
  }
}
