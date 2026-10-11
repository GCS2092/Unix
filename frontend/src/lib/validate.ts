export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())

export const phoneDigits = (v: string) => v.replace(/\D/g, "")

// 8 a 15 chiffres : couvre les numeros locaux (ex. 77 123 45 67) et internationaux (+221...)
export const isPhone = (v: string) => {
  const n = phoneDigits(v).length
  return n >= 8 && n <= 15
}