import type { Locale } from '../locales.js';

export const footerMessages = {
  'en-GB': {
    'footer.navigation': 'Footer navigation',
    'footer.strapline': 'Open source thrives with you.',
    'footer.lead':
      'Direct support for the tools you rely on. Clear fees. No hidden platform balance.',
    'footer.platform': 'Platform',
    'footer.about': 'About',
    'footer.security': 'Security',
    'footer.transparency': 'Transparency',
    'footer.terms': 'Terms',
    'footer.projects': 'Projects',
    'footer.documentation': 'Documentation',
    'footer.fees': 'How fees work',
    'footer.paymentNote': 'Payments run through Stripe. Each project is the merchant of record.',
    'footer.privacy': 'Privacy',
  },
  de: {
    'footer.navigation': 'Footer-Navigation',
    'footer.strapline': 'Open Source lebt von dir.',
    'footer.lead':
      'Direkte Unterstützung für die Tools, die du nutzt. Klare Gebühren. Kein verborgenes Plattformguthaben.',
    'footer.platform': 'Plattform',
    'footer.about': 'Über uns',
    'footer.security': 'Sicherheit',
    'footer.transparency': 'Transparenz',
    'footer.terms': 'Bedingungen',
    'footer.projects': 'Projekte',
    'footer.documentation': 'Dokumentation',
    'footer.fees': 'Gebühren erklärt',
    'footer.paymentNote':
      'Zahlungen laufen über Stripe. Jedes Projekt ist selbst Verkäufer und Zahlungsempfänger.',
    'footer.privacy': 'Datenschutz',
  },
  fr: {
    'footer.navigation': 'Navigation du pied de page',
    'footer.strapline': 'L’open source grandit avec vous.',
    'footer.lead':
      'Soutenez directement les outils que vous utilisez. Des frais clairs. Aucun solde de plateforme caché.',
    'footer.platform': 'Plateforme',
    'footer.about': 'À propos',
    'footer.security': 'Sécurité',
    'footer.transparency': 'Transparence',
    'footer.terms': 'Conditions',
    'footer.projects': 'Projets',
    'footer.documentation': 'Documentation',
    'footer.fees': 'Fonctionnement des frais',
    'footer.paymentNote':
      'Les paiements passent par Stripe. Chaque projet est le vendeur officiel de ses paiements.',
    'footer.privacy': 'Confidentialité',
  },
  es: {
    'footer.navigation': 'Navegación del pie de página',
    'footer.strapline': 'El código abierto crece contigo.',
    'footer.lead':
      'Apoya directamente las herramientas que usas. Comisiones claras. Sin saldo oculto en la plataforma.',
    'footer.platform': 'Plataforma',
    'footer.about': 'Acerca de',
    'footer.security': 'Seguridad',
    'footer.transparency': 'Transparencia',
    'footer.terms': 'Términos',
    'footer.projects': 'Proyectos',
    'footer.documentation': 'Documentación',
    'footer.fees': 'Cómo funcionan las comisiones',
    'footer.paymentNote':
      'Los pagos se procesan con Stripe. Cada proyecto es el vendedor registrado de sus pagos.',
    'footer.privacy': 'Privacidad',
  },
  'pt-BR': {
    'footer.navigation': 'Navegação do rodapé',
    'footer.strapline': 'O código aberto cresce com você.',
    'footer.lead':
      'Apoio direto às ferramentas que você usa. Taxas claras. Nenhum saldo oculto na plataforma.',
    'footer.platform': 'Plataforma',
    'footer.about': 'Sobre',
    'footer.security': 'Segurança',
    'footer.transparency': 'Transparência',
    'footer.terms': 'Termos',
    'footer.projects': 'Projetos',
    'footer.documentation': 'Documentação',
    'footer.fees': 'Como funcionam as taxas',
    'footer.paymentNote':
      'Os pagamentos são processados pela Stripe. Cada projeto é o vendedor responsável pelos próprios pagamentos.',
    'footer.privacy': 'Privacidade',
  },
} as const satisfies Record<Locale, Record<string, string>>;
