const KEY = "unix.contact"

export interface SavedContact {
  name?: string
  phone?: string
  city?: string
  district?: string
  address?: string
  landmark?: string
}

export function loadContact(): SavedContact {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as SavedContact
  } catch {
    return {}
  }
}

export function saveContact(contact: SavedContact) {
  try {
    const filled = Object.fromEntries(Object.entries(contact).filter(([, v]) => v))
    localStorage.setItem(KEY, JSON.stringify({ ...loadContact(), ...filled }))
  } catch {
    // stockage indisponible : on ignore
  }
}