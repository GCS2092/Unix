import i18n from "i18next"

const fr = {
  tour2: {
    admin_shop_payments: {
      intro: { title: "Les paiements", text: "Tout ce qui touche à l'argent des commandes : déclarations des clients, paiements en attente, échecs et anomalies. Le bouton « Tout vérifier » relit auprès de CinetPay les commandes en attente." },
      kpi: { title: "Les compteurs", text: "Chaque carte est un raccourci : cliquez pour afficher les paiements concernés. « À vérifier » regroupe les clients qui disent avoir payé." },
      tabs: { title: "Les onglets", text: "À vérifier, En attente, Échoués ou expirés, Anomalies (montant ou stock), Payés aujourd'hui, ou Tous. Le nombre entre parenthèses est le total de chaque onglet." },
      search: { title: "Un seul champ de recherche", text: "Collez une transaction, une référence, un nom, un téléphone, un mot comme « payé », « déclaré » ou « cash », ou une date comme 15/10/2026 00:41. Pendant une recherche, tous les onglets sont couverts." },
      list: { title: "Les actions par ligne", text: "« Vérifier CinetPay » relit le vrai statut. « Valider » marque la commande payée à la main. « Rejeter » efface la déclaration du client. « Marquer remboursé » est un simple suivi : aucun argent n'est renvoyé automatiquement. « Historique » liste tous les événements de la commande." },
    },
    admin_faq: {
      intro: { title: "La FAQ", text: "Les questions fréquentes affichées sur la page publique. L'ordre de la liste est celui du site." },
      add: { title: "Ajouter une question", text: "Le français est obligatoire, l'anglais est facultatif (renseignez alors la question et la réponse). Vous pouvez rattacher la question à un produit ou à une formation : elle s'affiche alors en premier sur sa page." },
      list: { title: "Gérer les questions", text: "Les flèches changent l'ordre. « Masquer » retire une question du site sans la supprimer. « Supprimer » est définitif." },
    },
    admin_formation_requests: {
      intro: { title: "Les demandes d'inscription", text: "Vérifiez la personne, puis acceptez ou refusez. L'étudiant est prévenu par e-mail." },
      filters: { title: "Rechercher et filtrer", text: "Cherchez par nom, e-mail ou téléphone, filtrez par cours, ou exportez la liste en Excel." },
      tabs: { title: "Les onglets", text: "En attente, Acceptées, Refusées. Le nombre indique combien de demandes contient chaque onglet." },
      list: { title: "La fiche d'une demande", text: "Cliquez une ligne pour ouvrir la fiche : identité, commandes, inscriptions et message. Vous pouvez accepter ou refuser avec un message, renvoyer l'e-mail de décision ou envoyer un lien de vérification ou de mot de passe." },
    },
    admin_formation_certificates: {
      intro: { title: "Les certificats", text: "Émettez, téléchargez et envoyez les certificats, un par un ou en lot. Un élève a au plus un certificat par formation." },
      views: { title: "Trois vues", text: "« Par élève » regroupe les formations de chaque personne. « Par statut » sert à traiter en lot. « Modèle » règle le design du PDF (organisme, signataire, logo, signature)." },
      filters: { title: "Recherche et cours", text: "Cherchez par nom, e-mail ou cours, ou limitez à un cours précis." },
      tiles: { title: "Les statuts", text: "Prêts à émettre, Examen non réussi, Délivrés, En cours. Cliquez une tuile pour changer d'onglet." },
      list: { title: "Actions sur un certificat", text: "Cochez des lignes pour télécharger ou envoyer par e-mail. « Corriger » modifie le nom ou la naissance et régénère le PDF. « Révoquer » demande un motif et peut être annulé avec « Rétablir »." },
    },
    admin_formation_share: {
      intro: { title: "Liens à partager", text: "Copiez un lien et envoyez-le par WhatsApp, SMS ou e-mail. La personne arrive sur la formation, crée son compte si besoin, puis demande l'accès." },
      base: { title: "Adresse du site", text: "Détectée automatiquement. Modifiez-la seulement si le site public a une autre adresse que celle de l'administration." },
      general: { title: "Liens généraux", text: "Le premier lien est le principal : formulaire complet d'inscription à une formation. Chaque lien se copie, ou s'envoie directement sur WhatsApp." },
      course: { title: "Un lien par formation", text: "Ce lien ouvre le formulaire avec la formation déjà choisie. Un cours en brouillon est signalé : il n'est pas visible du public." },
    },
    admin_system_presentation: {
      intro: { title: "Pages de présentation", text: "Une page d'accueil commune et une page pour la boutique et pour les formations, gérées par l'administration générale." },
      tabs: { title: "Choisir la page", text: "Accueil (commun), Boutique ou Formations. Chaque page a ses textes, ses images et sa publication." },
      images: { title: "Les images", text: "Les images sont enregistrées dès l'envoi (JPG, PNG ou WebP, 4 Mo maximum). Les images paysage fonctionnent le mieux." },
      save: { title: "Enregistrer les textes", text: "Les textes ne sont enregistrés qu'avec le bouton « Enregistrer les textes », en bas. Une page non publiée reste invisible des visiteurs." },
    },
    admin_system_activity: {
      search: { title: "Un seul champ de recherche", text: "Tapez un nom, un e-mail, une action, un n° de commande ou un mot-clé. Les boutons de catégorie (Commandes, Paiements, Stock…) remplissent la recherche d'un clic." },
      table: { title: "Le journal", text: "Les actions sont regroupées par jour. « Détails » affiche toutes les données enregistrées (auteur, objet, adresse IP, valeurs) et permet de copier l'entrée complète." },
    },
  },
}

const en = {
  tour2: {
    admin_shop_payments: {
      intro: { title: "Payments", text: "Everything about order money: customer claims, pending payments, failures and anomalies. “Verify all” rechecks pending orders with CinetPay." },
      kpi: { title: "Counters", text: "Each card is a shortcut: click to show the matching payments. “To verify” groups customers who say they paid." },
      tabs: { title: "Tabs", text: "To verify, Pending, Failed or expired, Anomalies (amount or stock), Paid today, or All. The number in brackets is each tab's total." },
      search: { title: "One search field", text: "Paste a transaction, a reference, a name, a phone number, a word like “paid”, “claimed” or “cash”, or a date like 15/10/2026 00:41. While searching, all tabs are covered." },
      list: { title: "Row actions", text: "“Verify CinetPay” rereads the real status. “Validate” marks the order paid by hand. “Reject” clears the customer's claim. “Mark refunded” is only a note: no money is sent back automatically. “History” lists every event of the order." },
    },
    admin_faq: {
      intro: { title: "FAQ", text: "Frequently asked questions shown on the public page. The list order is the order on the site." },
      add: { title: "Add a question", text: "French is required, English is optional (fill in both question and answer). You can attach the question to a product or a course: it then shows first on its page." },
      list: { title: "Manage questions", text: "Arrows change the order. “Hide” removes a question from the site without deleting it. “Delete” is permanent." },
    },
    admin_formation_requests: {
      intro: { title: "Enrollment requests", text: "Check the person, then accept or refuse. The student is notified by email." },
      filters: { title: "Search and filter", text: "Search by name, email or phone, filter by course, or export the list to Excel." },
      tabs: { title: "Tabs", text: "Pending, Accepted, Refused. The number shows how many requests each tab holds." },
      list: { title: "A request's details", text: "Click a row to open the details: identity, orders, enrollments and message. You can accept or refuse with a message, resend the decision email, or send a verification or password link." },
    },
    admin_formation_certificates: {
      intro: { title: "Certificates", text: "Issue, download and send certificates, one by one or in bulk. A student has at most one certificate per course." },
      views: { title: "Three views", text: "“By student” groups each person's courses. “By status” is for bulk work. “Template” sets the PDF design (organisation, signer, logo, signature)." },
      filters: { title: "Search and course", text: "Search by name, email or course, or limit to one course." },
      tiles: { title: "Statuses", text: "Ready to issue, Exam not passed, Issued, In progress. Click a tile to switch tab." },
      list: { title: "Certificate actions", text: "Tick rows to download or email. “Correct” edits the name or birth details and regenerates the PDF. “Revoke” asks for a reason and can be undone with “Restore”." },
    },
    admin_formation_share: {
      intro: { title: "Links to share", text: "Copy a link and send it by WhatsApp, SMS or email. The person lands on the course, creates an account if needed, then requests access." },
      base: { title: "Site address", text: "Detected automatically. Change it only if the public site has a different address from the admin." },
      general: { title: "General links", text: "The first link is the main one: the full course sign-up form. Each link can be copied or sent straight to WhatsApp." },
      course: { title: "One link per course", text: "This link opens the form with the course already selected. A draft course is flagged: it is not visible to the public." },
    },
    admin_system_presentation: {
      intro: { title: "Presentation pages", text: "A shared home page plus one page for the shop and one for courses, managed by the general administration." },
      tabs: { title: "Pick the page", text: "Home (shared), Shop or Courses. Each page has its own texts, images and publication." },
      images: { title: "Images", text: "Images are saved as soon as they are uploaded (JPG, PNG or WebP, 4 MB max). Landscape images work best." },
      save: { title: "Save the texts", text: "Texts are only saved with the “Save texts” button at the bottom. An unpublished page stays invisible to visitors." },
    },
    admin_system_activity: {
      search: { title: "One search field", text: "Type a name, an email, an action, an order number or a keyword. Category buttons (Orders, Payments, Stock…) fill the search in one click." },
      table: { title: "The log", text: "Actions are grouped by day. “Details” shows all recorded data (author, object, IP address, values) and lets you copy the full entry." },
    },
  },
}

i18n.addResourceBundle("fr", "translation", fr, true, true)
i18n.addResourceBundle("en", "translation", en, true, true)
