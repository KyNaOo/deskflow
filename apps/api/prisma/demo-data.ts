// Données de démonstration : organisations, comptes et historique de tickets.
// Génération pure et déterministe (graine fixe) : mêmes tickets à chaque exécution pour une même
// date, et un historique crédible pour le tableau de bord (volume plus fort en semaine, délais
// variés, statuts cohérents avec les dates).
import { Role, TicketPriority, TicketStatus } from '../src/generated/prisma/client.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Comme le job de clôture automatique : un ticket résolu depuis 7 jours est clos */
const AUTO_CLOSE_AFTER = 7 * DAY;

export interface DemoUser {
  email: string;
  name: string;
  role: Role;
}

export interface DemoOrganization {
  name: string;
  slug: string;
  users: DemoUser[];
  /** Nombre de jours d'historique, aujourd'hui compris */
  days: number;
  /** Tickets par jour, bornes comprises : [min, max] */
  weekdayVolume: [number, number];
  weekendVolume: [number, number];
  randomSeed: number;
}

export interface DemoMessage {
  authorEmail: string;
  body: string;
  createdAt: Date;
  isInternalNote?: boolean;
}

export interface DemoTicket {
  number: number;
  subject: string;
  priority: TicketPriority;
  status: TicketStatus;
  customerEmail: string;
  assigneeEmail: string | null;
  createdAt: Date;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  messages: DemoMessage[];
}

/** Présent dans les deux organisations : chacune a son propre compte pour ce même e-mail. */
const SHARED_CUSTOMER: DemoUser = { email: 'marie@exemple.test', name: 'Marie Durand', role: Role.CUSTOMER };

export const DEMO_ORGANIZATIONS: DemoOrganization[] = [
  {
    name: 'Acme Corp',
    slug: 'acme',
    users: [
      { email: 'admin@acme.test', name: 'Alice Admin', role: Role.ADMIN },
      { email: 'agent@acme.test', name: 'Bob Agent', role: Role.AGENT },
      { email: 'camille@acme.test', name: 'Camille Martin', role: Role.AGENT },
      { email: 'david@acme.test', name: 'David Petit', role: Role.AGENT },
      { email: 'client@acme.test', name: 'Chloé Client', role: Role.CUSTOMER },
      SHARED_CUSTOMER,
      { email: 'hugo@exemple.test', name: 'Hugo Bernard', role: Role.CUSTOMER },
      { email: 'lea@exemple.test', name: 'Léa Moreau', role: Role.CUSTOMER },
      { email: 'nicolas@exemple.test', name: 'Nicolas Roux', role: Role.CUSTOMER },
      { email: 'sarah@exemple.test', name: 'Sarah Fournier', role: Role.CUSTOMER },
    ],
    days: 60,
    weekdayVolume: [4, 10],
    weekendVolume: [0, 2],
    randomSeed: 42,
  },
  {
    name: 'Globex',
    slug: 'globex',
    users: [
      { email: 'admin@globex.test', name: 'Gabriel Admin', role: Role.ADMIN },
      { email: 'agent@globex.test', name: 'Inès Agent', role: Role.AGENT },
      { email: 'client@globex.test', name: 'Karim Client', role: Role.CUSTOMER },
      SHARED_CUSTOMER,
    ],
    days: 30,
    weekdayVolume: [0, 3],
    weekendVolume: [0, 1],
    randomSeed: 7,
  },
];

interface Topic {
  subject: string;
  priority: TicketPriority;
  question: string;
  answer: string;
  resolution: string;
}

const TOPICS: Topic[] = [
  {
    subject: 'Impossible de me connecter à mon compte',
    priority: TicketPriority.HIGH,
    question: 'Bonjour, depuis ce matin mon mot de passe est refusé alors que je ne l’ai pas changé.',
    answer: 'Bonjour, je viens de réinitialiser votre accès : vous avez dû recevoir un lien par e-mail. Pouvez-vous réessayer ?',
    resolution: 'Parfait, la connexion fonctionne de nouveau de votre côté. Je clos la demande.',
  },
  {
    subject: 'Facture du mois dernier introuvable',
    priority: TicketPriority.MEDIUM,
    question: 'Bonjour, je ne trouve pas la facture du mois dernier dans mon espace. Pouvez-vous me l’envoyer ?',
    answer: 'Bonjour, je vous la joins par e-mail. Elle sera aussi visible dans « Facturation » d’ici demain.',
    resolution: 'La facture est maintenant disponible dans votre espace. Bonne journée !',
  },
  {
    subject: 'Erreur 500 sur la page de paiement',
    priority: TicketPriority.URGENT,
    question: 'Bonjour, nos clients obtiennent une erreur 500 au moment de payer. C’est bloquant pour nous.',
    answer: 'Bonjour, nous reproduisons le problème et l’équipe technique est sur le correctif. Je vous tiens informé.',
    resolution: 'Le correctif est en production depuis 14 h : les paiements passent de nouveau.',
  },
  {
    subject: 'Problème d’impression depuis la mise à jour',
    priority: TicketPriority.HIGH,
    question: 'Bonjour, depuis la dernière mise à jour, l’impression des bons de commande ne fonctionne plus.',
    answer: 'Bonjour, pouvez-vous essayer de vider le cache du navigateur ? Une ancienne version du module peut rester chargée.',
    resolution: 'Le module d’impression a été corrigé dans la version du jour. Merci pour votre patience.',
  },
  {
    subject: 'Comment ajouter un collègue à notre espace ?',
    priority: TicketPriority.LOW,
    question: 'Bonjour, comment inviter une nouvelle collègue sur notre compte ?',
    answer: 'Bonjour, depuis « Paramètres › Membres », cliquez sur « Inviter » et saisissez son e-mail.',
    resolution: 'Votre collègue a bien rejoint l’espace. N’hésitez pas si besoin !',
  },
  {
    subject: 'Export CSV des données',
    priority: TicketPriority.MEDIUM,
    question: 'Bonjour, est-il possible d’exporter toutes nos commandes au format CSV ?',
    answer: 'Bonjour, oui : bouton « Exporter » en haut de la liste des commandes, avec les filtres appliqués.',
    resolution: 'L’export répond à votre besoin, je clos la demande.',
  },
  {
    subject: 'Demande de remboursement',
    priority: TicketPriority.MEDIUM,
    question: 'Bonjour, j’ai été débité deux fois pour le même abonnement. Pouvez-vous me rembourser ?',
    answer: 'Bonjour, je confirme le double prélèvement. Le remboursement est lancé, comptez 3 à 5 jours ouvrés.',
    resolution: 'Le remboursement a été effectué. Toutes nos excuses pour la gêne.',
  },
  {
    subject: 'Lenteurs sur le tableau de bord',
    priority: TicketPriority.MEDIUM,
    question: 'Bonjour, le tableau de bord met plus de 10 secondes à s’afficher depuis quelques jours.',
    answer: 'Bonjour, merci du signalement. Nous avons identifié une requête lente et préparons une optimisation.',
    resolution: 'L’optimisation est déployée : le tableau de bord s’affiche en moins d’une seconde.',
  },
  {
    subject: 'Notifications e-mail non reçues',
    priority: TicketPriority.LOW,
    question: 'Bonjour, je ne reçois plus les notifications par e-mail.',
    answer: 'Bonjour, nos e-mails partaient dans vos indésirables : pouvez-vous ajouter notre adresse à vos contacts ?',
    resolution: 'Les notifications arrivent de nouveau dans votre boîte de réception.',
  },
  {
    subject: 'Bug d’affichage sur mobile',
    priority: TicketPriority.LOW,
    question: 'Bonjour, sur iPhone, le bouton « Valider » est caché par le clavier.',
    answer: 'Bonjour, merci pour la capture. Le correctif est prévu dans la prochaine version.',
    resolution: 'La nouvelle version corrige l’affichage sur mobile.',
  },
  {
    subject: 'Changement d’adresse de facturation',
    priority: TicketPriority.LOW,
    question: 'Bonjour, nous avons déménagé : pouvez-vous mettre à jour notre adresse de facturation ?',
    answer: 'Bonjour, c’est fait. Les prochaines factures porteront la nouvelle adresse.',
    resolution: 'Adresse mise à jour, je clos la demande.',
  },
  {
    subject: 'Question sur l’offre Pro',
    priority: TicketPriority.LOW,
    question: 'Bonjour, l’offre Pro inclut-elle l’accès à l’API ?',
    answer: 'Bonjour, oui : l’offre Pro inclut l’API, avec 10 000 appels par jour.',
    resolution: 'Ravi d’avoir pu vous renseigner. Bonne journée !',
  },
];

const INTERNAL_NOTES = [
  'Client important : lui proposer un appel si le problème persiste.',
  'Déjà signalé la semaine dernière par un autre client, voir avec l’équipe technique.',
  'Vérifier son contrat avant de promettre un geste commercial.',
];

const CUSTOMER_FOLLOW_UP = 'Merci, mais le problème est toujours là de mon côté. Pouvez-vous revoir ?';

/** Générateur pseudo-aléatoire à graine (mulberry32) : même graine, même suite de nombres. */
function seededRandom(seed: number) {
  let state = seed;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  return {
    next,
    /** Entier entre min et max, bornes comprises */
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    between: (min: number, max: number) => min + next() * (max - min),
    pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)]!,
    chance: (probability: number) => next() < probability,
  };
}

type Random = ReturnType<typeof seededRandom>;

/** Délai de première réponse : souvent dans l'heure, parfois le lendemain. */
function firstResponseDelay(random: Random, priority: TicketPriority): number {
  const roll = random.next();
  const delay =
    roll < 0.6 ? random.between(10 * MINUTE, 2 * HOUR)
    : roll < 0.9 ? random.between(2 * HOUR, 10 * HOUR)
    : random.between(10 * HOUR, 40 * HOUR);
  // Les urgences passent devant
  return priority === TicketPriority.URGENT ? delay / 4 : delay;
}

/** Délai entre la première réponse et la résolution : de quelques heures à une semaine. */
function resolutionDelay(random: Random): number {
  const roll = random.next();
  return roll < 0.5 ? random.between(1 * HOUR, 20 * HOUR)
    : roll < 0.85 ? random.between(1 * DAY, 4 * DAY)
    : random.between(4 * DAY, 8 * DAY);
}

/**
 * Historique de tickets d'une organisation jusqu'à `now`, du plus ancien (n° 1) au plus récent.
 * Le statut découle des dates : sans réponse encore → OPEN ; répondu mais pas résolu → PENDING (ou
 * OPEN si le client a relancé) ; résolu → RESOLVED, puis CLOSED au bout de 7 jours.
 */
export function generateTickets(organization: DemoOrganization, now: Date): DemoTicket[] {
  const random = seededRandom(organization.randomSeed);
  const agents = organization.users.filter(({ role }) => role !== Role.CUSTOMER && role !== Role.ADMIN);
  const customers = organization.users.filter(({ role }) => role === Role.CUSTOMER);
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const tickets: Omit<DemoTicket, 'number'>[] = [];

  for (let daysAgo = organization.days - 1; daysAgo >= 0; daysAgo--) {
    const dayStart = todayStart - daysAgo * DAY;
    const weekday = new Date(dayStart).getUTCDay();
    const [min, max] = weekday === 0 || weekday === 6 ? organization.weekendVolume : organization.weekdayVolume;

    for (let count = random.int(min, max); count > 0; count--) {
      // Entre 7 h et 18 h UTC, soit les heures de bureau à Paris
      const createdAt = new Date(dayStart + random.between(7 * HOUR, 18 * HOUR));
      const topic = random.pick(TOPICS);
      const customer = random.pick(customers);
      const agent = random.pick(agents);
      // Tirés pour chaque ticket, même s'ils ne servent pas : la suite reste la même d'un ticket à l'autre
      const responseDelay = firstResponseDelay(random, topic.priority);
      const toResolve = resolutionDelay(random);
      const forgotten = random.chance(0.02);
      const followedUp = random.chance(0.3);
      const note = random.chance(0.08) ? random.pick(INTERNAL_NOTES) : null;
      if (createdAt.getTime() > now.getTime()) {
        continue;
      }

      const ticket: Omit<DemoTicket, 'number'> = {
        subject: topic.subject,
        priority: topic.priority,
        status: TicketStatus.OPEN,
        customerEmail: customer.email,
        assigneeEmail: null,
        createdAt,
        firstResponseAt: null,
        resolvedAt: null,
        messages: [{ authorEmail: customer.email, body: topic.question, createdAt }],
      };
      tickets.push(ticket);

      const firstResponseAt = new Date(createdAt.getTime() + responseDelay);
      if (forgotten || firstResponseAt > now) {
        // Pas encore pris en charge : assigné une fois sur deux
        ticket.assigneeEmail = followedUp ? agent.email : null;
        continue;
      }

      ticket.assigneeEmail = agent.email;
      ticket.firstResponseAt = firstResponseAt;
      if (note) {
        const noteAt = new Date(createdAt.getTime() + responseDelay / 2);
        ticket.messages.push({ authorEmail: agent.email, body: note, createdAt: noteAt, isInternalNote: true });
      }
      ticket.messages.push({ authorEmail: agent.email, body: topic.answer, createdAt: firstResponseAt });

      const resolvedAt = new Date(firstResponseAt.getTime() + toResolve);
      if (resolvedAt > now) {
        ticket.status = followedUp ? TicketStatus.OPEN : TicketStatus.PENDING;
        if (followedUp) {
          const followUpAt = new Date((firstResponseAt.getTime() + now.getTime()) / 2);
          ticket.messages.push({ authorEmail: customer.email, body: CUSTOMER_FOLLOW_UP, createdAt: followUpAt });
        }
        continue;
      }

      ticket.resolvedAt = resolvedAt;
      ticket.messages.push({ authorEmail: agent.email, body: topic.resolution, createdAt: resolvedAt });
      ticket.status =
        now.getTime() - resolvedAt.getTime() > AUTO_CLOSE_AFTER ? TicketStatus.CLOSED : TicketStatus.RESOLVED;
    }
  }

  return tickets
    .toSorted((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((ticket, index) => ({ ...ticket, number: index + 1 }));
}
