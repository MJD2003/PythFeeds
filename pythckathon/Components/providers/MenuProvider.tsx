"use client";

import React, { createContext, useContext, useState, type ReactNode } from "react";

interface MenuContextType {
  isMenuOpen: boolean;
  toggleMenu: () => void;
  closeMenu: () => void;
  authModal: "login" | "signup" | false;
  openAuth: (mode: "login" | "signup") => void;
  closeAuth: () => void;
}

const MenuContext = createContext<MenuContextType>({
  isMenuOpen: false,
  toggleMenu: () => {},
  closeMenu: () => {},
  authModal: false,
  openAuth: () => {},
  closeAuth: () => {},
});

export function MenuProvider({ children }: { children: ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [authModal, setAuthModal] = useState<"login" | "signup" | false>(false);

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);
  const openAuth = (mode: "login" | "signup") => setAuthModal(mode);
  const closeAuth = () => setAuthModal(false);

  return (
    <MenuContext.Provider
      value={{ isMenuOpen, toggleMenu, closeMenu, authModal, openAuth, closeAuth }}
    >
      {children}
    </MenuContext.Provider>
  );
}

export const useMenu = () => useContext(MenuContext);
