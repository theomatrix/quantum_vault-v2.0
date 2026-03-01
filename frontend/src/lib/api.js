// ==========================================
// API Layer
// ==========================================

const BASE = '';

export async function registerUser(payload) {
    const res = await fetch(`${BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return res.json();
}

export async function loginUser(username) {
    const res = await fetch(`${BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
    });
    if (!res.ok) throw new Error('User not found');
    return res.json();
}

export async function getVault(username) {
    const res = await fetch(`${BASE}/api/vault/${username}`);
    if (!res.ok) throw new Error('Failed to load vault');
    return res.json();
}

export async function addCredential(username, payload) {
    const res = await fetch(`${BASE}/api/vault/${username}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return res.json();
}

export async function deleteCredential(username, id) {
    const res = await fetch(`${BASE}/api/vault/${username}/delete/${id}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error('Delete failed');
    return res.json();
}
