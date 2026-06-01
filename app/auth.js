const { ipcMain, app } = require('electron');
const fs = require('fs');
const path = require('path');
const { LOCAL_FILE_PATH } = require("./main/helpers/paths.js")

const tokenFile = LOCAL_FILE_PATH
const { API } = require("./main/helpers/paths.js");

async function register(username, email, password, passwordConfirm) {
    try {
        const response = await fetch(`${API}/auth/register.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                password,
                email,
                passwordConfirm
            })
        });

        const result = await response.json();
        
        console.log(`POST ${API}/auth/register.php:`)
        console.log(`>`, result)

        if (!response.ok) {
            return {
                success: false,
                result: result.result || 'Registration failed'
            };
        }

        return {
            success: true,
            result: result.result
        };
    } catch (error) {
        return {
            success: false,
            result: error.message
        };
    }
}

async function login(email, password) {
    try {
        const response = await fetch(`${API}/auth/checkLogin.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        const result = await response.json();

        if (!response.ok) {
            return {
                success: false,
                result: result.result || 'Login failed'
            };
        }

        return {
            success: true,
            result: result.result
        };
    } catch (error) {
        return {
            success: false,
            result: error.message
        };
    }
}

async function loginById(id, password) {
    try {
        const response = await fetch(`${API}/auth/checkLogin.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id,
                password
            })
        });

        const result = await response.json();

        if (!response.ok) {
            return {
                success: false,
                result: result.result || 'Login failed'
            };
        }

        return {
            success: true,
            result: result.result
        };
    } catch (error) {
        return {
            success: false,
            result: error.message
        };
    }
}

async function verifyToken(token) {
    try {
        const response = await fetch(`${API}/verifyToken.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        return {
            success: response.ok,
            result: result.result
        };
    } catch (error) {
        return {
            success: false,
            result: error.message
        };
    }
}

function saveToken(tokenData) {
    try {
        fs.writeFileSync(tokenFile, JSON.stringify(tokenData, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving token:', error);
        return false;
    }
}

function loadToken() {
    try {
        if (fs.existsSync(tokenFile)) {
            const data = fs.readFileSync(tokenFile, 'utf-8');
            return JSON.parse(data);
        }
        return null;
    } catch (error) {
        console.error('Error loading token:', error);
        return null;
    }
}

function deleteToken() {
    try {
        if (fs.existsSync(tokenFile)) {
            fs.unlinkSync(tokenFile);
        }
        return true;
    } catch (error) {
        console.error('Error deleting token:', error);
        return false;
    }
}

function decodeJWT(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const payload = JSON.parse(
            Buffer.from(parts[1], 'base64').toString('utf-8')
        );

        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }

        return payload;
    } catch (error) {
        console.error('Error decoding JWT:', error);
        return null;
    }
}

async function recoveryCode(email) {
    try {
        const response = await fetch(`${API}/auth/requestRecovery.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        const data = await response.json()

        if (data.success) {
            return { success: true, result: data.result }
        } else {
            return { success: false, result: data.result }
        }
    } catch (error) {
        return { success: false, result: error }
    }
}

async function verifyRecoveryCode(email, code) {
    try {
        const response = await fetch(`${API}/auth/verifyRecoveryCode.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, code })
        });

        const data = await response.json()

        console.log("VRC:", data)

        if (data.success) {
            return { success: true, result: data.result }
        } else {
            return { success: false, result: data.result }
        }
    } catch (error) {
        return { success: false, result: error }
    }
}

async function resetPassword(recoveryToken, newPassword) {
    try {
        const response = await fetch(`${API}/auth/resetPassword.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ recovery_token: recoveryToken, new_password: newPassword })
        });

        const data = await response.json()

        if (data.success) {
            return { success: true, result: data.result }
        } else {
            return { success: false, result: data.result }
        }
    } catch (error) {
        return { success: false, result: error }
    }
}

ipcMain.handle('register', async (_e, username, email, password, passwordConfirm) => {
    return await register(username, email, password, passwordConfirm);
});

ipcMain.handle('login', async (_e, email, password) => {
    const result = await login(email, password);

    if (result.success && result.result.token) {
        saveToken({
            token: result.result.token,
            user: result.result.user,
            expiresIn: result.result.expiresIn,
            savedAt: new Date().toISOString()
        });
    }

    return result;
});

ipcMain.handle('request-recovery-code', async (_, email) => {
    return await recoveryCode(email)
})

ipcMain.handle('verify-recovery-code', async (_, email, code) => {
    return await verifyRecoveryCode(email, code)
})

ipcMain.handle('reset-password', async (_, recoveryToken, newPassword) => {
    return await resetPassword(recoveryToken, newPassword)
})

ipcMain.handle('login-by-id', async (_e, id, password) => {
    const result = await loginById(id, password);

    if (result.success && result.result.token) {
        saveToken({
            token: result.result.token,
            user: result.result.user,
            expiresIn: result.result.expiresIn,
            savedAt: new Date().toISOString()
        });
    }

    return result;
});

ipcMain.handle('logout', async () => {
    deleteToken();
    return {
        success: true,
        result: 'Logged out successfully'
    };
});

ipcMain.handle('get-token', async () => {
    const tokenData = loadToken();

    if (!tokenData) {
        return {
            success: false,
            result: null
        };
    }

    const decoded = decodeJWT(tokenData.token);

    if (!decoded) {
        deleteToken();
        return {
            success: false,
            result: null
        };
    }

    return {
        success: true,
        result: tokenData
    };
});

ipcMain.handle('is-logged-in', async () => {
    const tokenData = loadToken();

    if (!tokenData) {
        return false;
    }

    const decoded = decodeJWT(tokenData.token);

    if (!decoded) {
        deleteToken();
        return false;
    }

    return true;
});

ipcMain.handle("set-non-account-mode", async (_, value = true) => {
    let data = {}

    try {
        if (fs.existsSync(LOCAL_FILE_PATH)) {
            const raw = fs.readFileSync(LOCAL_FILE_PATH, "utf-8")
            data = JSON.parse(raw || "{}")
        }
    } catch (e) {
        data = {}
    }

    data.nonAccountMode = value

    try {
        fs.writeFileSync(LOCAL_FILE_PATH, JSON.stringify(data, null, 4), "utf-8")
        return { ok: true }
    } catch (e) {
        return { ok: false }
    }
})

module.exports = { API, login, verifyToken }