import { createContext, useContext, useState } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [masterKey, setMasterKey] = useState(null);
    const [kyberPK, setKyberPK] = useState(null);
    const [kyberSK, setKyberSK] = useState(null);
    const [currentUserSalt, setCurrentUserSalt] = useState(null);

    function setUser({ username, masterKey, kyberPK, kyberSK, salt }) {
        setCurrentUser(username);
        setMasterKey(masterKey);
        setKyberPK(kyberPK);
        setKyberSK(kyberSK);
        setCurrentUserSalt(salt);
    }

    function logout() {
        setCurrentUser(null);
        setMasterKey(null);
        setKyberPK(null);
        setKyberSK(null);
        setCurrentUserSalt(null);
    }

    return (
        <AppContext.Provider value={{
            currentUser, masterKey, kyberPK, kyberSK, currentUserSalt,
            setUser, logout
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    return useContext(AppContext);
}
