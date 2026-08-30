import type { Locale } from '../locales.js';

export const aboutMessages = {
  'en-GB': {
    'about.kicker': 'oss.tips / ABOUT',
    'about.title': 'About',
    'about.lead':
      'oss.tips helps open-source projects take one-off support and memberships. The project is the merchant. We run the tooling. We do not hold project money.',
    'about.howItWorks': 'How it works',
    'about.whoUsesIt': 'Who uses it',
    'about.belief.noWallet': 'No project wallet on oss.tips',
    'about.belief.fees': 'Fees shown before checkout',
    'about.belief.guest': 'One-off support works without an account',
    'about.belief.memberships': 'Memberships give access. There is no shop catalogue',
    'about.belief.privacy': 'Names and amounts stay private unless a supporter opts in',
    'about.audience':
      'Maintainers who need steady funding without running a storefront. Supporters who want to know where the money goes and what access they receive.',
  },
  de: {
    'about.kicker': 'oss.tips / ÜBER UNS',
    'about.title': 'Über oss.tips',
    'about.lead':
      'oss.tips hilft Open-Source-Projekten mit einmaliger Unterstützung und Mitgliedschaften. Das Projekt ist der Verkäufer. Wir stellen die Werkzeuge bereit. Projektgelder bleiben beim Projekt.',
    'about.howItWorks': 'So funktioniert es',
    'about.whoUsesIt': 'Wer nutzt es',
    'about.belief.noWallet': 'Kein Projektguthaben auf oss.tips',
    'about.belief.fees': 'Gebühren vor dem Checkout sichtbar',
    'about.belief.guest': 'Einmalige Unterstützung ohne Konto',
    'about.belief.memberships': 'Mitgliedschaften geben Zugang. Es gibt keinen Shop-Katalog',
    'about.belief.privacy': 'Namen und Beträge bleiben privat, sofern Unterstützer nicht zustimmen',
    'about.audience':
      'Maintainer, die verlässliche Finanzierung ohne eigenen Shop brauchen. Unterstützer, die wissen wollen, wohin ihr Geld geht und welchen Zugang sie erhalten.',
  },
  fr: {
    'about.kicker': 'oss.tips / À PROPOS',
    'about.title': 'À propos',
    'about.lead':
      'oss.tips aide les projets open source à recevoir des soutiens ponctuels et des adhésions. Le projet est le vendeur. Nous fournissons les outils. Nous ne détenons pas l’argent des projets.',
    'about.howItWorks': 'Comment ça marche',
    'about.whoUsesIt': 'Qui l’utilise',
    'about.belief.noWallet': 'Aucun portefeuille de projet sur oss.tips',
    'about.belief.fees': 'Les frais sont affichés avant le paiement',
    'about.belief.guest': 'Le soutien ponctuel fonctionne sans compte',
    'about.belief.memberships': 'Les adhésions donnent accès au projet. Il n’y a pas de catalogue',
    'about.belief.privacy': 'Les noms et les montants restent privés, sauf accord du soutien',
    'about.audience':
      'Les mainteneurs qui ont besoin d’un financement régulier sans gérer une boutique. Les soutiens qui veulent savoir où va leur argent et quels accès ils reçoivent.',
  },
  es: {
    'about.kicker': 'oss.tips / ACERCA DE',
    'about.title': 'Acerca de',
    'about.lead':
      'oss.tips ayuda a los proyectos de código abierto a recibir apoyo puntual y membresías. El proyecto es el vendedor. Nosotros ponemos las herramientas. No guardamos el dinero de los proyectos.',
    'about.howItWorks': 'Cómo funciona',
    'about.whoUsesIt': 'Quién lo usa',
    'about.belief.noWallet': 'No hay una cartera de proyecto en oss.tips',
    'about.belief.fees': 'Las comisiones se muestran antes del pago',
    'about.belief.guest': 'El apoyo puntual funciona sin cuenta',
    'about.belief.memberships': 'Las membresías dan acceso. No hay un catálogo de tienda',
    'about.belief.privacy':
      'Los nombres y las cantidades son privados salvo que la persona los comparta',
    'about.audience':
      'Personas mantenedoras que necesitan financiación estable sin gestionar una tienda. Personas colaboradoras que quieren saber adónde va su dinero y qué acceso reciben.',
  },
  'pt-BR': {
    'about.kicker': 'oss.tips / SOBRE',
    'about.title': 'Sobre',
    'about.lead':
      'O oss.tips ajuda projetos de código aberto a receber apoio avulso e associações. O projeto é o vendedor. Nós fornecemos as ferramentas. Não mantemos o dinheiro dos projetos.',
    'about.howItWorks': 'Como funciona',
    'about.whoUsesIt': 'Quem usa',
    'about.belief.noWallet': 'Não há carteira de projeto no oss.tips',
    'about.belief.fees': 'As taxas aparecem antes do checkout',
    'about.belief.guest': 'O apoio avulso funciona sem uma conta',
    'about.belief.memberships': 'As associações dão acesso. Não há catálogo de loja',
    'about.belief.privacy':
      'Nomes e valores ficam privados, a menos que a pessoa apoiadora opte por mostrá-los',
    'about.audience':
      'Mantenedores que precisam de financiamento constante sem administrar uma loja. Pessoas apoiadoras que querem saber para onde vai o dinheiro e qual acesso recebem.',
  },
} as const satisfies Record<Locale, Record<string, string>>;
