/** Identifiant du contenu principal, cible du lien d'évitement. */
export const MAIN_CONTENT_ID = "contenu";

/**
 * Premier élément atteint au clavier : permet de sauter l'en-tête et sa navigation, répétés sur
 * chaque page. Invisible jusqu'à ce qu'il reçoive le focus.
 */
export function SkipLink() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md"
    >
      Aller au contenu
    </a>
  );
}
