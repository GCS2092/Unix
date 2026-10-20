import i18n from "../i18n"

const fr = {
  formation: {
    back: "Toutes les formations",
    not_found: "Cette formation est introuvable.",
    teacher: "Formateur",
    duration: "Durée",
    minutes: "{{n}} min",
    hours: "{{h}} h {{m}} min",
    price: "Prix",
    has_exam: "Examen final et certificat vérifiable",
    has_live: "Séances en direct",
    login_to_enroll: "Se connecter pour s'inscrire",
    open: "Ouvrir le cours",
    enrolled: "Vous êtes inscrit à cette formation.",
    buy: "S'inscrire (acheter)",
    request_title: "Demander l'accès",
    request_hint: "Notre équipe examine chaque demande et vous prévient dès qu'elle est traitée.",
    message_label: "Message (facultatif)",
    message_ph: "Présentez-vous en quelques mots…",
    send: "Envoyer ma demande",
    sent: "Demande envoyée. Vous serez prévenu dès qu'elle sera traitée.",
    pending: "Demande envoyée, en cours d'examen.",
    pending_since: "Envoyée le {{date}}.",
    rejected: "Votre dernière demande n'a pas été acceptée.",
    reason: "Motif : {{note}}",
    retry: "Vous pouvez refaire une demande ci-dessous.",
    or_request: "Ou demandez l'accès à l'équipe :",
    details: "Détails",
  },
}

const en = {
  formation: {
    back: "All courses",
    not_found: "This course could not be found.",
    teacher: "Instructor",
    duration: "Duration",
    minutes: "{{n}} min",
    hours: "{{h}} h {{m}} min",
    price: "Price",
    has_exam: "Final exam and verifiable certificate",
    has_live: "Live sessions",
    login_to_enroll: "Log in to enroll",
    open: "Open the course",
    enrolled: "You are enrolled in this course.",
    buy: "Enroll (buy)",
    request_title: "Request access",
    request_hint: "Our team reviews every request and will let you know once it is processed.",
    message_label: "Message (optional)",
    message_ph: "Tell us a bit about yourself…",
    send: "Send my request",
    sent: "Request sent. You will be notified once it is processed.",
    pending: "Request sent, under review.",
    pending_since: "Sent on {{date}}.",
    rejected: "Your last request was not accepted.",
    reason: "Reason: {{note}}",
    retry: "You can send a new request below.",
    or_request: "Or request access from the team:",
    details: "Details",
  },
}

const defaultNs = i18n.options.defaultNS
const ns = (Array.isArray(defaultNs) ? defaultNs[0] : defaultNs) || "translation"
i18n.addResourceBundle("fr", ns, fr, true, false)
i18n.addResourceBundle("en", ns, en, true, false)