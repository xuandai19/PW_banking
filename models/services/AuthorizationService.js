class AuthorizationService {

    getCurrentUser() {
        return null;
    }

    hasRole(role, user = null) {

        const currentUser = user || this.getCurrentUser();

        if (!currentUser) {
            return false;
        }

        return currentUser.role === role;

    }

    isAdmin(user = null) {
        return this.hasRole("ADMIN", user);
    }

    isSubAdmin(user = null) {
        return this.hasRole("SUBADMIN", user);
    }

    isEmployee(user = null) {
        return this.hasRole("EMPLOYEE", user);
    }

    canManageBank(user = null) {
        return this.isAdmin(user);
    }

    canManageBranch(user = null) {
        const currentUser = user || this.getCurrentUser();
        return ["ADMIN", "SUBADMIN", "BANK"].includes(currentUser?.role);
    }

    canManageAccount(user = null) {
        return this.isAdmin(user) || this.isSubAdmin(user) || this.isEmployee(user);
    }

    /**
     * Admin có thể tạo Subadmin + Employee
     * Subadmin chỉ có thể tạo Employee
     */
    canCreateUser(user = null) {
        return this.isAdmin(user) || this.isSubAdmin(user);
    }

    /**
     * Kiểm tra creator có được phép tạo role mục tiêu hay không
     */
    canCreateRole(targetRole, user = null) {
        const currentUser = user || this.getCurrentUser();
        if (!currentUser) return false;

        const role = String(targetRole).toUpperCase();

        if (this.isAdmin(currentUser)) {
            return role === "SUBADMIN" || role === "EMPLOYEE";
        }

        if (this.isSubAdmin(currentUser)) {
            // Subadmin chỉ tạo EMPLOYEE
            return role === "EMPLOYEE";
        }

        return false;
    }

    canApprove(user = null) {
        return this.isAdmin(user);
    }

    requiresApproval(action, user = null) {
        const currentUser = user || this.getCurrentUser();

        if (!currentUser || this.isAdmin(currentUser)) {
            return false;
        }

        if (["BANK", "BRANCH", "SUBADMIN", "EMPLOYEE"].includes(currentUser.role)) {
            return ["CREATE_BRANCH", "CREATE_ACCOUNT", "UPDATE_ACCOUNT", "DELETE_ACCOUNT", "DEPOSIT", "WITHDRAW", "TRANSFER"].includes(action);
        }
        return true;
    }

}

module.exports = new AuthorizationService();
