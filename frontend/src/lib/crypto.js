// ==========================================
// Crypto Utilities — ported from Scripts.js
// ==========================================

export function toHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export function fromHex(hex) {
    return new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
}

export function generateSalt() {
    return window.crypto.getRandomValues(new Uint8Array(16));
}

export async function deriveMasterKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

export async function encryptAES(key, plaintext) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        enc.encode(plaintext)
    );

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);
    return toHex(combined);
}

export async function decryptAES(key, hexData) {
    const data = fromHex(hexData);
    const iv = data.slice(0, 12);
    const ciphertext = data.slice(12);

    try {
        const decrypted = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            ciphertext
        );
        return new TextDecoder().decode(decrypted);
    } catch {
        throw new Error('Decryption failed — wrong password or corrupted data');
    }
}

export function calcPasswordStrength(password) {
    if (!password) return { score: 0, label: 'None', color: 'transparent', width: '0%' };
    let strength = 0;
    if (password.length > 5) strength++;
    if (password.length > 10) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    if (strength >= 4) return { score: strength, label: 'Strong', color: '#22c55e', width: '100%' };
    if (strength >= 2) return { score: strength, label: 'Medium', color: '#eab308', width: '60%' };
    return { score: strength, label: 'Weak', color: '#ef4444', width: '20%' };
}
