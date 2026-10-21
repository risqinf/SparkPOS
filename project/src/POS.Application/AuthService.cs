using System;
using System.Threading.Tasks;
using POS.Domain;

namespace POS.Application;

public class AuthService
{
    private readonly IEmployeeRepository _employeeRepo;

    public Employee? CurrentEmployee { get; private set; }

    public AuthService(IEmployeeRepository employeeRepo)
    {
        _employeeRepo = employeeRepo;
    }

    public async Task<bool> LoginAsync(string username, string pin)
    {
        var employee = await _employeeRepo.AuthenticateAsync(username, pin);
        if (employee != null)
        {
            CurrentEmployee = employee;
            return true;
        }
        return false;
    }

    public async Task<bool> LoginWithPinOnlyAsync(string pin)
    {
        var employee = await _employeeRepo.AuthenticatePinOnlyAsync(pin);
        if (employee != null)
        {
            CurrentEmployee = employee;
            return true;
        }
        return false;
    }

    public void Logout()
    {
        CurrentEmployee = null;
    }

    public async Task<bool> VerifySupervisorPinAsync(string pin)
    {
        var emp = await _employeeRepo.AuthenticatePinOnlyAsync(pin);
        if (emp != null && (emp.Role == RoleType.Supervisor || emp.Role == RoleType.Admin))
        {
            return true;
        }
        return false;
    }
}
