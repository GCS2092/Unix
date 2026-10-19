import i18n from "i18next"

const fr = {
  tour2: {
    admin_shop_settings: {
      intro: { title: "Les paramètres", text: "Réglez ici votre boutique et vos contenus publics. Pour voir les bannières et les images de la page À propos, ouvrez la section « À propos et réseaux » puis relancez ce guide avec le « ? »." },
      nav: { title: "Les sections", text: "Chaque section regroupe un thème : identité, commandes, paiement, vitrine, À propos… Cliquez pour changer de section." },
      preview: { title: "Voir le résultat", text: "Ces boutons ouvrent la page concernée dans un nouvel onglet, pour vérifier vos changements sur le site." },
      banners: { title: "Les bannières", text: "Ajoutez une image de fond pour l'accueil et pour la page À propos. Glissez une image ici ou cliquez pour la choisir (2 Mo maximum)." },
      bannerswitch: { title: "Afficher ou masquer", text: "Cet interrupteur masque la bannière sur le site sans la supprimer. Vous pouvez la réafficher à tout moment." },
      gallery: { title: "Les images des sections", text: "Jusqu'à 3 images par section (histoire, boutique, formations, accompagnement). Elles s'affichent alignées sur la page À propos." },
      eye: { title: "Masquer une image", text: "L'œil cache une image du site sans la supprimer. La croix la supprime définitivement." },
      save: { title: "Enregistrer vos changements", text: "Dès que vous modifiez un champ, une barre « Modifications non enregistrées » apparaît en bas de l'écran. Utilisez Enregistrer pour valider ou Annuler pour revenir en arrière." },
    },
  },
}

const en = {
  tour2: {
    admin_shop_settings: {
      intro: { title: "Settings", text: "Configure your shop and public content here. To see the banners and images of the About page, open the “About and social” section, then restart this guide with the “?”." },
      nav: { title: "Sections", text: "Each section groups a topic: identity, orders, payment, storefront, About… Click to switch section." },
      preview: { title: "See the result", text: "These buttons open the page in a new tab so you can check your changes on the site." },
      banners: { title: "Banners", text: "Add a background image for the home page and the About page. Drop an image here or click to choose it (2 MB max)." },
      bannerswitch: { title: "Show or hide", text: "This switch hides the banner on the site without deleting it. You can show it again at any time." },
      gallery: { title: "Section images", text: "Up to 3 images per section (story, shop, courses, support). They appear aligned on the About page." },
      eye: { title: "Hide an image", text: "The eye hides an image from the site without deleting it. The cross deletes it for good." },
      save: { title: "Save your changes", text: "As soon as you edit a field, an “Unsaved changes” bar appears at the bottom of the screen. Use Save to confirm or Cancel to go back." },
    },
  },
}

i18n.addResourceBundle("fr", "translation", fr, true, false)
i18n.addResourceBundle("en", "translation", en, true, false)