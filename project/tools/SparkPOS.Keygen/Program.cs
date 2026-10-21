using System;
using System.Windows.Forms;

namespace SparkPOS.Keygen;

internal static class Program
{
    [STAThread]
    static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new FormKeygen());
    }
}
