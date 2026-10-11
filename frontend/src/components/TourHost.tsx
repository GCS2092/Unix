import { useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { driver, type DriveStep } from "driver.js"
import "driver.js/dist/driver.css"
import { useAuthStore } from "../stores/authStore"
import { useDrawerStore } from "../stores/drawerStore"
import { useConfirmStore } from "../stores/confirmStore"
import { useTourStore } from "../stores/tourStore"
import { toast } from "../stores/toastStore"
import { autoDisabled, disableAuto, hasSeen, markSeen, resolveTour, type StepSide, type TourDef } from "../lib/tours"

type Side = "top" | "right" | "bottom" | "left"
type DriverInstance = ReturnType<typeof driver>
type Popover = NonNullable<DriveStep["popover"]>

const START_DELAY_MS = 1500 // apres le chargement de la page
const POLL_MS = 700
const GIVE_UP_MS = 5 * 60_000

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))

// Visible = a une taille et se trouve horizontalement dans l'ecran
// (ecarte les menus caches par `hidden md:flex` et le tiroir admin ferme sur mobile)
function isShown(el: Element) {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth
}

function pickVisible(sel: string): Element | null {
  return Array.from(document.querySelectorAll(sel)).find(isShown) ?? null
}

function isBlocked(): boolean {
  if (document.visibilityState !== "visible") return true
  if (useDrawerStore.getState().open) return true
  if (useConfirmStore.getState().current) return true
  // Invitation d'installation, mise a jour PWA, menu WhatsApp, menu Langue/Devise ouverts
  if (document.querySelector("[data-tour-block]")) return true
  // La page charge encore (squelettes, spinners)
  if (document.querySelector('main [role="status"][aria-label], main svg.animate-spin, main .skeleton-shimmer')) return true
  if (/Chargement|Loading/.test(document.querySelector("main")?.textContent ?? "")) return true
  return false
}

function resolveSide(side: StepSide | undefined, el?: Element | null): Side | undefined {
  if (!side) return undefined
  if (side === "sidebar") return window.innerWidth >= 1024 ? "right" : "bottom"
  if (side === "auto") {
    if (!el) return undefined
    const r = el.getBoundingClientRect()
    return r.top + r.height / 2 > window.innerHeight / 2 ? "top" : "bottom"
  }
  return side
}

export default function TourHost() {
  const { i18n } = useTranslation()
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const authLoading = useAuthStore((s) => s.loading)
  const manual = useTourStore((s) => s.manual)
  const handled = useRef(0)
  const running = useRef<DriverInstance | null>(null)

  useEffect(() => {
    if (authLoading) return

    const forced = manual !== handled.current // clic sur le bouton d'aide
    const tour = resolveTour(pathname, user)

    if (!tour) {
      if (forced) {
        handled.current = manual
        toast.info(i18n.t("tour.none"))
      }
      return
    }
    if (!forced && (tour.manual || autoDisabled() || hasSeen(tour))) return

    let cancelled = false
    let timer = 0
    let calm = 0
    const startedAt = Date.now()
    const adminDrawer = tour.id.startsWith("admin_") && window.innerWidth < 1024
    const setMenu = (open: boolean) => window.dispatchEvent(new CustomEvent("unix:admin-menu", { detail: open }))
    const isSide = (side?: StepSide) => side === "sidebar"

    const launch = async (def: TourDef) => {
      handled.current = manual

      const found = def.steps
        .map((st) => {
          let el: Element | null = null
          if (st.sel) el = adminDrawer && isSide(st.side) ? document.querySelector(st.sel) : pickVisible(st.sel)
          return { st, el }
        })
        .filter((x) => !x.st.sel || x.el) // etapes dont l'element est absent : sautees

      if (found.length === 0) {
        if (forced) toast.info(i18n.t("tour.none"))
        return
      }

      const steps: DriveStep[] = found.map(({ st, el }, i): DriveStep => {
        const base = st.k ?? `tour.${def.id}.${st.id}`
        const sel = st.sel
        const side = isSide(st.side)
        const prevSide = i > 0 && isSide(found[i - 1].st.side)
        const nextSide = i < found.length - 1 && isSide(found[i + 1].st.side)

        const popover: Popover = {
          title: i18n.t(`${base}.title`),
          description: i18n.t(`${base}.text`),
          side: resolveSide(st.side, el),
          align: "center",
        }

        // Mobile admin : le menu est un tiroir, on l'ouvre quand on arrive sur ses etapes
        if (adminDrawer && !side && nextSide) {
          popover.onNextClick = async (_el, _step, { driver: d }) => {
            setMenu(true)
            await sleep(340)
            d.moveNext()
          }
        }
        if (adminDrawer && side && !prevSide && i > 0) {
          popover.onPrevClick = async (_el, _step, { driver: d }) => {
            setMenu(false)
            await sleep(340)
            d.movePrevious()
          }
        }

        return {
          element: sel
            ? () => (adminDrawer && side ? document.querySelector(sel) : pickVisible(sel)) as Element
            : undefined,
          popover,
        }
      })

      if (adminDrawer && isSide(found[0].st.side)) {
        setMenu(true)
        await sleep(380)
        if (cancelled) return
      }

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      const skipLabel = i18n.t("tour.skip")
      const offLabel = i18n.t("tour.off")

      const drv = driver({
        steps,
        showProgress: steps.length > 1,
        progressText: "{{current}} / {{total}}",
        nextBtnText: i18n.t("tour.next"),
        prevBtnText: i18n.t("tour.prev"),
        doneBtnText: i18n.t("tour.done"),
        allowClose: true,
        overlayColor: "#0f172a",
        overlayOpacity: 0.62,
        overlayClickBehavior: () => {}, // un toucher a cote ne ferme pas la visite
        stagePadding: 6,
        stageRadius: 12,
        popoverOffset: 12,
        smoothScroll: !reduced,
        animate: !reduced,
        popoverClass: "unix-tour",
        onPopoverRender: (popover, { state }) => {
          popover.wrapper.querySelectorAll(".unix-tour-skip").forEach((n) => n.remove())
          const last = (state.activeIndex ?? 0) >= steps.length - 1
          const add = (label: string, fn: () => void) => {
            const btn = document.createElement("button")
            btn.type = "button"
            btn.className = "unix-tour-skip"
            btn.textContent = label
            btn.addEventListener("click", fn)
            popover.wrapper.appendChild(btn)
          }
          if (!last) add(skipLabel, () => drv.destroy())
          if (!forced) {
            add(offLabel, () => {
              disableAuto()
              drv.destroy()
            })
          }
        },
        onDestroyed: () => {
          markSeen(def) // terminee, passee ou fermee : on ne la repropose pas automatiquement
          running.current = null
          useTourStore.getState().setActive(false)
          if (adminDrawer) setMenu(false)
        },
      })

      running.current = drv
      useTourStore.getState().setActive(true)
      drv.drive()
    }

    // On attend que la page soit calme (2 controles consecutifs sans popup ni chargement)
    const tick = () => {
      if (cancelled) return
      calm = isBlocked() ? 0 : calm + 1
      if (calm >= 2) {
        void launch(tour)
        return
      }
      if (Date.now() - startedAt < GIVE_UP_MS) timer = window.setTimeout(tick, POLL_MS)
    }
    timer = window.setTimeout(tick, forced ? 300 : START_DELAY_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      // Changement de page pendant la visite : on la ferme proprement
      const d = running.current
      if (d?.isActive()) d.destroy()
    }
  }, [authLoading, pathname, user, manual, i18n])

  return null
}