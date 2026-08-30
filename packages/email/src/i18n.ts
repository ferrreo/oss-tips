export const EMAIL_LOCALES = ['en-GB', 'de', 'fr', 'es', 'pt-BR'] as const;
export type EmailLocale = (typeof EMAIL_LOCALES)[number];

export type ReviewStatus = 'approved' | 'rejected' | 'action_required';
export type MembershipEmailEvent =
  'started' | 'renewed' | 'cancelled' | 'payment_failed' | 'grace_ending';
export type ApiKeyChange = 'created' | 'revoked';
export type WebhookChange =
  'created' | 'updated' | 'removed' | 'secret_rotated' | 'enabled' | 'disabled' | 'status_updated';

type OtpCopy = { subject: string; text: string; htmlCode: string; htmlExpiry: string };

type EmailCopy = {
  money: { projectAmount: string; projectFee: string; amount: string };
  otp: OtpCopy & { support: OtpCopy };
  security: {
    subject: string;
    intro: string;
    eventLabel: string;
    ipLabel: string;
    deviceLabel: string;
    textEvent: string;
    textIp: string;
    textDevice: string;
  };
  teamInvite: {
    subject: string;
    text: string;
    intro: string;
    accept: string;
    expires: string;
    roles: Record<string, string>;
  };
  membership: {
    titles: Record<MembershipEmailEvent, string>;
    subject: string;
    text: string;
    body: string;
    manage: string;
  };
  receipt: { subject: string; thanks: string; view: string };
  refund: {
    subject: string;
    text: string;
    intro: string;
    reason: string;
    disputeSubject: string;
    disputeText: string;
    disputeIntro: string;
    status: string;
    amount: string;
  };
  domain: {
    subject: string;
    text: string;
    intro: string;
    review: string;
    fix: string;
  };
  stripe: { subject: string; text: string; intro: string };
  review: {
    subject: string;
    statuses: Record<ReviewStatus, { label: string; text: string }>;
  };
  securityChange: { subject: string; text: string; intro: string };
  apiKey: {
    subject: string;
    actions: Record<ApiKeyChange, { text: string; intro: string }>;
    name: string;
  };
  webhook: {
    subject: string;
    actions: Record<WebhookChange, { text: string; intro: string }>;
    endpoint: string;
  };
  post: {
    subject: string;
    htmlTitle: string;
    published: string;
    publishedText: string;
    read: string;
  };
  reply: { subject: string; text: string; intro: string; view: string };
};

export const emailMessages = {
  'en-GB': {
    money: {
      projectAmount: 'Project amount',
      projectFee: 'oss.tips project fee',
      amount: 'Amount',
    },
    otp: {
      subject: 'Your oss.tips sign-in code',
      text: 'Your sign-in code is {code}. It expires in {minutes} minutes.',
      htmlCode: 'Your sign-in code is <strong>{code}</strong>.',
      htmlExpiry: 'It expires in {minutes} minutes.',
      support: {
        subject: 'Verify your support email on oss.tips',
        text: 'Your support email verification code is {code}. It expires in {minutes} minutes.',
        htmlCode: 'Your support email verification code is <strong>{code}</strong>.',
        htmlExpiry: 'It expires in {minutes} minutes.',
      },
    },
    security: {
      subject: 'New sign-in to your oss.tips account',
      intro: 'A new sign-in was detected on your oss.tips account.',
      eventLabel: 'Event',
      ipLabel: 'IP',
      deviceLabel: 'Device',
      textEvent: 'Security event: {event}',
      textIp: ' from {ip}',
      textDevice: ' ({userAgent})',
    },
    teamInvite: {
      subject: 'Invitation to join {projectName} on oss.tips',
      text: 'You have been invited to join {projectName} as {role}. Accept here: {inviteUrl} (expires {expires})',
      intro:
        'You have been invited to join <strong>{projectName}</strong> as <strong>{role}</strong>.',
      accept: 'Accept invitation',
      expires: 'Expires: {expires}',
      roles: {
        admin: 'an administrator',
        finance: 'a finance member',
        editor: 'an editor',
        community: 'a community member',
        analyst: 'an analyst',
      },
    },
    membership: {
      titles: {
        started: 'Membership started',
        renewed: 'Membership renewed',
        cancelled: 'Membership cancelled',
        payment_failed: 'Membership payment failed',
        grace_ending: 'Membership grace period ending',
      },
      subject: '{title}: {projectName}',
      text: '{title} for {projectName}.',
      body: '<strong>{title}</strong> for {projectName}.',
      manage: 'Manage membership',
    },
    receipt: {
      subject: 'Receipt for your support of {projectName}',
      thanks: 'Thank you for supporting',
      view: 'View receipt',
    },
    refund: {
      subject: 'Refund from {projectName}',
      text: 'A refund was issued for {projectName}. {money}',
      intro: 'A refund was issued for <strong>{projectName}</strong>.',
      reason: 'Reason: {reason}',
      disputeSubject: 'Dispute update: {projectName}',
      disputeText: 'Dispute status: {status}. Amount: {amount} {currency}',
      disputeIntro: 'Dispute update for <strong>{projectName}</strong>.',
      status: 'Status',
      amount: 'Amount',
    },
    domain: {
      subject: 'Custom domain issue: {domain}',
      text: 'Domain {domain} for {projectName} failed: {failure}',
      intro: 'Custom domain <strong>{domain}</strong> for {projectName} needs attention.',
      review: 'Review domain settings',
      fix: 'Fix: {actionUrl}',
    },
    stripe: {
      subject: 'Stripe account restriction: {projectName}',
      text: 'Stripe restriction for {projectName}: {restriction}',
      intro: 'Stripe account restriction for <strong>{projectName}</strong>:',
    },
    review: {
      subject: 'Project {status}: {projectName}',
      statuses: {
        approved: { label: 'approved', text: '{projectName} was approved.' },
        rejected: { label: 'rejected', text: '{projectName} was rejected.' },
        action_required: { label: 'needs action', text: '{projectName} needs action.' },
      },
    },
    securityChange: {
      subject: 'Security change: {projectName}',
      text: 'Security change for {projectName}: {change}',
      intro: 'Security change for <strong>{projectName}</strong>:',
    },
    apiKey: {
      subject: 'API key change: {projectName}',
      actions: {
        created: {
          text: 'API key created for {projectName}.',
          intro: 'An API key was created for <strong>{projectName}</strong>.',
        },
        revoked: {
          text: 'API key revoked for {projectName}.',
          intro: 'An API key was revoked for <strong>{projectName}</strong>.',
        },
      },
      name: 'Key name: {name}',
    },
    webhook: {
      subject: 'Webhook change: {projectName}',
      actions: {
        created: {
          text: 'Webhook created for {projectName}.',
          intro: 'A webhook was created for <strong>{projectName}</strong>.',
        },
        updated: {
          text: 'Webhook updated for {projectName}.',
          intro: 'A webhook was updated for <strong>{projectName}</strong>.',
        },
        removed: {
          text: 'Webhook removed for {projectName}.',
          intro: 'A webhook was removed for <strong>{projectName}</strong>.',
        },
        secret_rotated: {
          text: 'Webhook secret rotated for {projectName}.',
          intro: 'A webhook secret was rotated for <strong>{projectName}</strong>.',
        },
        enabled: {
          text: 'Webhook enabled for {projectName}.',
          intro: 'A webhook was enabled for <strong>{projectName}</strong>.',
        },
        disabled: {
          text: 'Webhook disabled for {projectName}.',
          intro: 'A webhook was disabled for <strong>{projectName}</strong>.',
        },
        status_updated: {
          text: 'Webhook status updated for {projectName}.',
          intro: 'A webhook status was updated for <strong>{projectName}</strong>.',
        },
      },
      endpoint: 'Endpoint: {endpoint}',
    },
    post: {
      subject: '{projectName}: {title}',
      htmlTitle: 'New project post',
      published: '<strong>{projectName}</strong> published a new post: <strong>{title}</strong>',
      publishedText: '{projectName} published a new post: {title}',
      read: 'Read post',
    },
    reply: {
      subject: '{projectName} replied to your message',
      text: '{projectName} replied: {preview}\nRead: {threadUrl}',
      intro: '<strong>{projectName}</strong> replied to your message:',
      view: 'View thread',
    },
  },
  de: {
    money: {
      projectAmount: 'Projektbetrag',
      projectFee: 'oss.tips-Projektgebühr',
      amount: 'Betrag',
    },
    otp: {
      subject: 'Dein Anmeldecode von oss.tips',
      text: 'Dein Anmeldecode lautet {code}. Er läuft in {minutes} Minuten ab.',
      htmlCode: 'Dein Anmeldecode lautet <strong>{code}</strong>.',
      htmlExpiry: 'Er läuft in {minutes} Minuten ab.',
      support: {
        subject: 'Bestätige deine Support-E-Mail bei oss.tips',
        text: 'Dein Bestätigungscode für die Support-E-Mail lautet {code}. Er läuft in {minutes} Minuten ab.',
        htmlCode: 'Dein Bestätigungscode für die Support-E-Mail lautet <strong>{code}</strong>.',
        htmlExpiry: 'Er läuft in {minutes} Minuten ab.',
      },
    },
    security: {
      subject: 'Neue Anmeldung bei deinem oss.tips-Konto',
      intro: 'Eine neue Anmeldung bei deinem oss.tips-Konto wurde erkannt.',
      eventLabel: 'Ereignis',
      ipLabel: 'IP',
      deviceLabel: 'Gerät',
      textEvent: 'Sicherheitsereignis: {event}',
      textIp: ' von {ip}',
      textDevice: ' ({userAgent})',
    },
    teamInvite: {
      subject: 'Einladung zu {projectName} auf oss.tips',
      text: 'Du wurdest als {role} zu {projectName} eingeladen. Einladung annehmen: {inviteUrl} (gültig bis {expires})',
      intro: 'Du wurdest als <strong>{role}</strong> zu <strong>{projectName}</strong> eingeladen.',
      accept: 'Einladung annehmen',
      expires: 'Gültig bis: {expires}',
      roles: {
        admin: 'Administrator',
        finance: 'Finanzmitglied',
        editor: 'Editor',
        community: 'Community-Mitglied',
        analyst: 'Analyst',
      },
    },
    membership: {
      titles: {
        started: 'Mitgliedschaft gestartet',
        renewed: 'Mitgliedschaft verlängert',
        cancelled: 'Mitgliedschaft gekündigt',
        payment_failed: 'Mitgliedschaftszahlung fehlgeschlagen',
        grace_ending: 'Kulanzzeit der Mitgliedschaft endet',
      },
      subject: '{title}: {projectName}',
      text: '{title} für {projectName}.',
      body: '<strong>{title}</strong> für {projectName}.',
      manage: 'Mitgliedschaft verwalten',
    },
    receipt: {
      subject: 'Beleg für deine Unterstützung von {projectName}',
      thanks: 'Danke für deine Unterstützung von',
      view: 'Beleg ansehen',
    },
    refund: {
      subject: 'Rückerstattung von {projectName}',
      text: 'Für {projectName} wurde eine Rückerstattung ausgestellt. {money}',
      intro: 'Für <strong>{projectName}</strong> wurde eine Rückerstattung ausgestellt.',
      reason: 'Grund: {reason}',
      disputeSubject: 'Streitfall-Update: {projectName}',
      disputeText: 'Status des Streitfalls: {status}. Betrag: {amount} {currency}',
      disputeIntro: 'Update zum Streitfall für <strong>{projectName}</strong>.',
      status: 'Status',
      amount: 'Betrag',
    },
    domain: {
      subject: 'Problem mit benutzerdefinierter Domain: {domain}',
      text: 'Die Domain {domain} für {projectName} ist fehlgeschlagen: {failure}',
      intro:
        'Die benutzerdefinierte Domain <strong>{domain}</strong> für {projectName} braucht Aufmerksamkeit.',
      review: 'Domain-Einstellungen prüfen',
      fix: 'Beheben: {actionUrl}',
    },
    stripe: {
      subject: 'Einschränkung des Stripe-Kontos: {projectName}',
      text: 'Stripe-Einschränkung für {projectName}: {restriction}',
      intro: 'Einschränkung des Stripe-Kontos für <strong>{projectName}</strong>:',
    },
    review: {
      subject: 'Projekt {status}: {projectName}',
      statuses: {
        approved: { label: 'genehmigt', text: '{projectName} wurde genehmigt.' },
        rejected: { label: 'abgelehnt', text: '{projectName} wurde abgelehnt.' },
        action_required: {
          label: 'benötigt weitere Angaben',
          text: 'Für {projectName} sind weitere Angaben erforderlich.',
        },
      },
    },
    securityChange: {
      subject: 'Sicherheitsänderung: {projectName}',
      text: 'Sicherheitsänderung für {projectName}: {change}',
      intro: 'Sicherheitsänderung für <strong>{projectName}</strong>:',
    },
    apiKey: {
      subject: 'Änderung eines API-Schlüssels: {projectName}',
      actions: {
        created: {
          text: 'API-Schlüssel für {projectName} erstellt.',
          intro: 'Ein API-Schlüssel wurde für <strong>{projectName}</strong> erstellt.',
        },
        revoked: {
          text: 'API-Schlüssel für {projectName} widerrufen.',
          intro: 'Ein API-Schlüssel wurde für <strong>{projectName}</strong> widerrufen.',
        },
      },
      name: 'Schlüsselname: {name}',
    },
    webhook: {
      subject: 'Webhook-Änderung: {projectName}',
      actions: {
        created: {
          text: 'Webhook für {projectName} erstellt.',
          intro: 'Ein Webhook wurde für <strong>{projectName}</strong> erstellt.',
        },
        updated: {
          text: 'Webhook für {projectName} aktualisiert.',
          intro: 'Ein Webhook wurde für <strong>{projectName}</strong> aktualisiert.',
        },
        removed: {
          text: 'Webhook für {projectName} entfernt.',
          intro: 'Ein Webhook wurde für <strong>{projectName}</strong> entfernt.',
        },
        secret_rotated: {
          text: 'Webhook-Geheimnis für {projectName} geändert.',
          intro: 'Das Webhook-Geheimnis für <strong>{projectName}</strong> wurde geändert.',
        },
        enabled: {
          text: 'Webhook für {projectName} aktiviert.',
          intro: 'Ein Webhook wurde für <strong>{projectName}</strong> aktiviert.',
        },
        disabled: {
          text: 'Webhook für {projectName} deaktiviert.',
          intro: 'Ein Webhook wurde für <strong>{projectName}</strong> deaktiviert.',
        },
        status_updated: {
          text: 'Webhook-Status für {projectName} aktualisiert.',
          intro: 'Der Webhook-Status für <strong>{projectName}</strong> wurde aktualisiert.',
        },
      },
      endpoint: 'Endpunkt: {endpoint}',
    },
    post: {
      subject: '{projectName}: {title}',
      htmlTitle: 'Neuer Projektbeitrag',
      published:
        '<strong>{projectName}</strong> hat einen neuen Beitrag veröffentlicht: <strong>{title}</strong>',
      publishedText: '{projectName} hat einen neuen Beitrag veröffentlicht: {title}',
      read: 'Beitrag lesen',
    },
    reply: {
      subject: '{projectName} hat auf deine Nachricht geantwortet',
      text: '{projectName} hat geantwortet: {preview}\nLesen: {threadUrl}',
      intro: '<strong>{projectName}</strong> hat auf deine Nachricht geantwortet:',
      view: 'Thread ansehen',
    },
  },
  fr: {
    money: {
      projectAmount: 'Montant du projet',
      projectFee: 'Frais de projet oss.tips',
      amount: 'Montant',
    },
    otp: {
      subject: 'Votre code de connexion oss.tips',
      text: 'Votre code de connexion est {code}. Il expire dans {minutes} minutes.',
      htmlCode: 'Votre code de connexion est <strong>{code}</strong>.',
      htmlExpiry: 'Il expire dans {minutes} minutes.',
      support: {
        subject: 'Vérifiez votre adresse e-mail de support oss.tips',
        text: 'Votre code de vérification de l’adresse e-mail de support est {code}. Il expire dans {minutes} minutes.',
        htmlCode:
          'Votre code de vérification de l’adresse e-mail de support est <strong>{code}</strong>.',
        htmlExpiry: 'Il expire dans {minutes} minutes.',
      },
    },
    security: {
      subject: 'Nouvelle connexion à votre compte oss.tips',
      intro: 'Une nouvelle connexion a été détectée sur votre compte oss.tips.',
      eventLabel: 'Événement',
      ipLabel: 'IP',
      deviceLabel: 'Appareil',
      textEvent: 'Événement de sécurité : {event}',
      textIp: ' depuis {ip}',
      textDevice: ' ({userAgent})',
    },
    teamInvite: {
      subject: 'Invitation à rejoindre {projectName} sur oss.tips',
      text: 'Vous avez reçu une invitation à rejoindre {projectName} en tant que {role}. Acceptez ici : {inviteUrl} (expiration : {expires})',
      intro:
        'Vous avez reçu une invitation à rejoindre <strong>{projectName}</strong> en tant que <strong>{role}</strong>.',
      accept: "Accepter l'invitation",
      expires: 'Expire le : {expires}',
      roles: {
        admin: 'administrateur',
        finance: 'membre de la finance',
        editor: 'éditeur',
        community: 'membre de la communauté',
        analyst: 'analyste',
      },
    },
    membership: {
      titles: {
        started: 'Adhésion commencée',
        renewed: 'Adhésion renouvelée',
        cancelled: 'Adhésion annulée',
        payment_failed: "Échec du paiement de l'adhésion",
        grace_ending: "La période de grâce de l'adhésion se termine",
      },
      subject: '{title} : {projectName}',
      text: '{title} pour {projectName}.',
      body: '<strong>{title}</strong> pour {projectName}.',
      manage: 'Gérer l’adhésion',
    },
    receipt: {
      subject: 'Reçu pour votre soutien à {projectName}',
      thanks: 'Merci de soutenir',
      view: 'Voir le reçu',
    },
    refund: {
      subject: 'Remboursement de {projectName}',
      text: 'Un remboursement a été émis pour {projectName}. {money}',
      intro: 'Un remboursement a été émis pour <strong>{projectName}</strong>.',
      reason: 'Motif : {reason}',
      disputeSubject: 'Mise à jour du litige : {projectName}',
      disputeText: 'Statut du litige : {status}. Montant : {amount} {currency}',
      disputeIntro: 'Mise à jour du litige pour <strong>{projectName}</strong>.',
      status: 'Statut',
      amount: 'Montant',
    },
    domain: {
      subject: 'Problème de domaine personnalisé : {domain}',
      text: 'Le domaine {domain} de {projectName} a échoué : {failure}',
      intro:
        'Le domaine personnalisé <strong>{domain}</strong> de {projectName} demande votre attention.',
      review: 'Vérifier les réglages du domaine',
      fix: 'Corriger : {actionUrl}',
    },
    stripe: {
      subject: 'Restriction du compte Stripe : {projectName}',
      text: 'Restriction Stripe pour {projectName} : {restriction}',
      intro: 'Restriction du compte Stripe pour <strong>{projectName}</strong> :',
    },
    review: {
      subject: 'Projet {status} : {projectName}',
      statuses: {
        approved: { label: 'approuvé', text: '{projectName} a été approuvé.' },
        rejected: { label: 'rejeté', text: '{projectName} a été rejeté.' },
        action_required: {
          label: 'requiert une action',
          text: '{projectName} requiert une action.',
        },
      },
    },
    securityChange: {
      subject: 'Modification de sécurité : {projectName}',
      text: 'Modification de sécurité pour {projectName} : {change}',
      intro: 'Modification de sécurité pour <strong>{projectName}</strong> :',
    },
    apiKey: {
      subject: 'Modification de clé API : {projectName}',
      actions: {
        created: {
          text: 'Clé API créée pour {projectName}.',
          intro: 'Une clé API a été créée pour <strong>{projectName}</strong>.',
        },
        revoked: {
          text: 'Clé API révoquée pour {projectName}.',
          intro: 'Une clé API a été révoquée pour <strong>{projectName}</strong>.',
        },
      },
      name: 'Nom de la clé : {name}',
    },
    webhook: {
      subject: 'Modification de webhook : {projectName}',
      actions: {
        created: {
          text: 'Webhook créé pour {projectName}.',
          intro: 'Un webhook a été créé pour <strong>{projectName}</strong>.',
        },
        updated: {
          text: 'Webhook mis à jour pour {projectName}.',
          intro: 'Un webhook a été mis à jour pour <strong>{projectName}</strong>.',
        },
        removed: {
          text: 'Webhook supprimé pour {projectName}.',
          intro: 'Un webhook a été supprimé pour <strong>{projectName}</strong>.',
        },
        secret_rotated: {
          text: 'Secret du webhook renouvelé pour {projectName}.',
          intro: 'Le secret du webhook pour <strong>{projectName}</strong> a été renouvelé.',
        },
        enabled: {
          text: 'Webhook activé pour {projectName}.',
          intro: 'Un webhook a été activé pour <strong>{projectName}</strong>.',
        },
        disabled: {
          text: 'Webhook désactivé pour {projectName}.',
          intro: 'Un webhook a été désactivé pour <strong>{projectName}</strong>.',
        },
        status_updated: {
          text: 'Statut du webhook mis à jour pour {projectName}.',
          intro: 'Le statut du webhook pour <strong>{projectName}</strong> a été mis à jour.',
        },
      },
      endpoint: 'Point de terminaison : {endpoint}',
    },
    post: {
      subject: '{projectName} : {title}',
      htmlTitle: 'Nouvel article du projet',
      published:
        '<strong>{projectName}</strong> a publié un nouvel article : <strong>{title}</strong>',
      publishedText: '{projectName} a publié un nouvel article : {title}',
      read: "Lire l'article",
    },
    reply: {
      subject: '{projectName} a répondu à votre message',
      text: '{projectName} a répondu : {preview}\nLire : {threadUrl}',
      intro: '<strong>{projectName}</strong> a répondu à votre message :',
      view: 'Voir la conversation',
    },
  },
  es: {
    money: {
      projectAmount: 'Importe del proyecto',
      projectFee: 'Comisión del proyecto de oss.tips',
      amount: 'Importe',
    },
    otp: {
      subject: 'Tu código de acceso de oss.tips',
      text: 'Tu código de acceso es {code}. Caduca en {minutes} minutos.',
      htmlCode: 'Tu código de acceso es <strong>{code}</strong>.',
      htmlExpiry: 'Caduca en {minutes} minutos.',
      support: {
        subject: 'Verifica tu correo de soporte en oss.tips',
        text: 'Tu código de verificación del correo de soporte es {code}. Caduca en {minutes} minutos.',
        htmlCode: 'Tu código de verificación del correo de soporte es <strong>{code}</strong>.',
        htmlExpiry: 'Caduca en {minutes} minutos.',
      },
    },
    security: {
      subject: 'Nuevo acceso a tu cuenta de oss.tips',
      intro: 'Se ha detectado un nuevo acceso a tu cuenta de oss.tips.',
      eventLabel: 'Evento',
      ipLabel: 'IP',
      deviceLabel: 'Dispositivo',
      textEvent: 'Evento de seguridad: {event}',
      textIp: ' desde {ip}',
      textDevice: ' ({userAgent})',
    },
    teamInvite: {
      subject: 'Invitación para unirte a {projectName} en oss.tips',
      text: 'Te han invitado a unirte a {projectName} como {role}. Acepta aquí: {inviteUrl} (caduca el {expires})',
      intro:
        'Te han invitado a unirte a <strong>{projectName}</strong> como <strong>{role}</strong>.',
      accept: 'Aceptar invitación',
      expires: 'Caduca: {expires}',
      roles: {
        admin: 'administrador',
        finance: 'persona de finanzas',
        editor: 'editor',
        community: 'persona de la comunidad',
        analyst: 'analista',
      },
    },
    membership: {
      titles: {
        started: 'Membresía iniciada',
        renewed: 'Membresía renovada',
        cancelled: 'Membresía cancelada',
        payment_failed: 'Falló el pago de la membresía',
        grace_ending: 'Termina el periodo de gracia de la membresía',
      },
      subject: '{title}: {projectName}',
      text: '{title} para {projectName}.',
      body: '<strong>{title}</strong> para {projectName}.',
      manage: 'Gestionar membresía',
    },
    receipt: {
      subject: 'Recibo por tu apoyo a {projectName}',
      thanks: 'Gracias por apoyar a',
      view: 'Ver recibo',
    },
    refund: {
      subject: 'Reembolso de {projectName}',
      text: 'Se emitió un reembolso para {projectName}. {money}',
      intro: 'Se emitió un reembolso para <strong>{projectName}</strong>.',
      reason: 'Motivo: {reason}',
      disputeSubject: 'Actualización de disputa: {projectName}',
      disputeText: 'Estado de la disputa: {status}. Importe: {amount} {currency}',
      disputeIntro: 'Actualización de la disputa para <strong>{projectName}</strong>.',
      status: 'Estado',
      amount: 'Importe',
    },
    domain: {
      subject: 'Problema con el dominio personalizado: {domain}',
      text: 'El dominio {domain} de {projectName} falló: {failure}',
      intro:
        'El dominio personalizado <strong>{domain}</strong> de {projectName} necesita atención.',
      review: 'Revisar configuración del dominio',
      fix: 'Solucionar: {actionUrl}',
    },
    stripe: {
      subject: 'Restricción de la cuenta de Stripe: {projectName}',
      text: 'Restricción de Stripe para {projectName}: {restriction}',
      intro: 'Restricción de la cuenta de Stripe para <strong>{projectName}</strong>:',
    },
    review: {
      subject: 'Proyecto {status}: {projectName}',
      statuses: {
        approved: { label: 'aprobado', text: '{projectName} fue aprobado.' },
        rejected: { label: 'rechazado', text: '{projectName} fue rechazado.' },
        action_required: { label: 'requiere acciones', text: '{projectName} requiere acciones.' },
      },
    },
    securityChange: {
      subject: 'Cambio de seguridad: {projectName}',
      text: 'Cambio de seguridad para {projectName}: {change}',
      intro: 'Cambio de seguridad para <strong>{projectName}</strong>:',
    },
    apiKey: {
      subject: 'Cambio de clave API: {projectName}',
      actions: {
        created: {
          text: 'Clave API creada para {projectName}.',
          intro: 'Se creó una clave API para <strong>{projectName}</strong>.',
        },
        revoked: {
          text: 'Clave API revocada para {projectName}.',
          intro: 'Se revocó una clave API para <strong>{projectName}</strong>.',
        },
      },
      name: 'Nombre de la clave: {name}',
    },
    webhook: {
      subject: 'Cambio de webhook: {projectName}',
      actions: {
        created: {
          text: 'Webhook creado para {projectName}.',
          intro: 'Se creó un webhook para <strong>{projectName}</strong>.',
        },
        updated: {
          text: 'Webhook actualizado para {projectName}.',
          intro: 'Se actualizó un webhook para <strong>{projectName}</strong>.',
        },
        removed: {
          text: 'Webhook eliminado para {projectName}.',
          intro: 'Se eliminó un webhook para <strong>{projectName}</strong>.',
        },
        secret_rotated: {
          text: 'Se renovó el secreto del webhook para {projectName}.',
          intro: 'Se renovó el secreto del webhook para <strong>{projectName}</strong>.',
        },
        enabled: {
          text: 'Webhook activado para {projectName}.',
          intro: 'Se activó un webhook para <strong>{projectName}</strong>.',
        },
        disabled: {
          text: 'Webhook desactivado para {projectName}.',
          intro: 'Se desactivó un webhook para <strong>{projectName}</strong>.',
        },
        status_updated: {
          text: 'Estado del webhook actualizado para {projectName}.',
          intro: 'Se actualizó el estado del webhook para <strong>{projectName}</strong>.',
        },
      },
      endpoint: 'Endpoint: {endpoint}',
    },
    post: {
      subject: '{projectName}: {title}',
      htmlTitle: 'Nueva publicación del proyecto',
      published:
        '<strong>{projectName}</strong> publicó una nueva entrada: <strong>{title}</strong>',
      publishedText: '{projectName} publicó una nueva entrada: {title}',
      read: 'Leer publicación',
    },
    reply: {
      subject: '{projectName} respondió a tu mensaje',
      text: '{projectName} respondió: {preview}\nLeer: {threadUrl}',
      intro: '<strong>{projectName}</strong> respondió a tu mensaje:',
      view: 'Ver conversación',
    },
  },
  'pt-BR': {
    money: {
      projectAmount: 'Valor do projeto',
      projectFee: 'Taxa do projeto oss.tips',
      amount: 'Valor',
    },
    otp: {
      subject: 'Seu código de acesso do oss.tips',
      text: 'Seu código de acesso é {code}. Ele expira em {minutes} minutos.',
      htmlCode: 'Seu código de acesso é <strong>{code}</strong>.',
      htmlExpiry: 'Ele expira em {minutes} minutos.',
      support: {
        subject: 'Confirme seu e-mail de suporte no oss.tips',
        text: 'Seu código de confirmação do e-mail de suporte é {code}. Ele expira em {minutes} minutos.',
        htmlCode: 'Seu código de confirmação do e-mail de suporte é <strong>{code}</strong>.',
        htmlExpiry: 'Ele expira em {minutes} minutos.',
      },
    },
    security: {
      subject: 'Novo acesso à sua conta oss.tips',
      intro: 'Um novo acesso foi detectado na sua conta oss.tips.',
      eventLabel: 'Evento',
      ipLabel: 'IP',
      deviceLabel: 'Dispositivo',
      textEvent: 'Evento de segurança: {event}',
      textIp: ' de {ip}',
      textDevice: ' ({userAgent})',
    },
    teamInvite: {
      subject: 'Convite para entrar em {projectName} no oss.tips',
      text: 'Você foi convidado a entrar em {projectName} como {role}. Aceite aqui: {inviteUrl} (expira em {expires})',
      intro:
        'Você foi convidado a entrar em <strong>{projectName}</strong> como <strong>{role}</strong>.',
      accept: 'Aceitar convite',
      expires: 'Expira em: {expires}',
      roles: {
        admin: 'administrador',
        finance: 'pessoa da área financeira',
        editor: 'editor',
        community: 'pessoa da comunidade',
        analyst: 'analista',
      },
    },
    membership: {
      titles: {
        started: 'Assinatura iniciada',
        renewed: 'Assinatura renovada',
        cancelled: 'Assinatura cancelada',
        payment_failed: 'Falha no pagamento da assinatura',
        grace_ending: 'O período de tolerância da assinatura está terminando',
      },
      subject: '{title}: {projectName}',
      text: '{title} para {projectName}.',
      body: '<strong>{title}</strong> para {projectName}.',
      manage: 'Gerenciar assinatura',
    },
    receipt: {
      subject: 'Recibo pelo seu apoio a {projectName}',
      thanks: 'Obrigado por apoiar',
      view: 'Ver recibo',
    },
    refund: {
      subject: 'Reembolso de {projectName}',
      text: 'Um reembolso foi emitido para {projectName}. {money}',
      intro: 'Um reembolso foi emitido para <strong>{projectName}</strong>.',
      reason: 'Motivo: {reason}',
      disputeSubject: 'Atualização da contestação: {projectName}',
      disputeText: 'Status da contestação: {status}. Valor: {amount} {currency}',
      disputeIntro: 'Atualização da contestação para <strong>{projectName}</strong>.',
      status: 'Status',
      amount: 'Valor',
    },
    domain: {
      subject: 'Problema com o domínio personalizado: {domain}',
      text: 'O domínio {domain} de {projectName} falhou: {failure}',
      intro:
        'O domínio personalizado <strong>{domain}</strong> de {projectName} precisa de atenção.',
      review: 'Revisar configurações do domínio',
      fix: 'Corrigir: {actionUrl}',
    },
    stripe: {
      subject: 'Restrição da conta Stripe: {projectName}',
      text: 'Restrição da Stripe para {projectName}: {restriction}',
      intro: 'Restrição da conta Stripe para <strong>{projectName}</strong>:',
    },
    review: {
      subject: 'Projeto {status}: {projectName}',
      statuses: {
        approved: { label: 'aprovado', text: '{projectName} foi aprovado.' },
        rejected: { label: 'rejeitado', text: '{projectName} foi rejeitado.' },
        action_required: { label: 'requer ação', text: '{projectName} requer ação.' },
      },
    },
    securityChange: {
      subject: 'Alteração de segurança: {projectName}',
      text: 'Alteração de segurança para {projectName}: {change}',
      intro: 'Alteração de segurança para <strong>{projectName}</strong>:',
    },
    apiKey: {
      subject: 'Alteração de chave de API: {projectName}',
      actions: {
        created: {
          text: 'Chave de API criada para {projectName}.',
          intro: 'Uma chave de API foi criada para <strong>{projectName}</strong>.',
        },
        revoked: {
          text: 'Chave de API revogada para {projectName}.',
          intro: 'Uma chave de API foi revogada para <strong>{projectName}</strong>.',
        },
      },
      name: 'Nome da chave: {name}',
    },
    webhook: {
      subject: 'Alteração de webhook: {projectName}',
      actions: {
        created: {
          text: 'Webhook criado para {projectName}.',
          intro: 'Um webhook foi criado para <strong>{projectName}</strong>.',
        },
        updated: {
          text: 'Webhook atualizado para {projectName}.',
          intro: 'Um webhook foi atualizado para <strong>{projectName}</strong>.',
        },
        removed: {
          text: 'Webhook removido para {projectName}.',
          intro: 'Um webhook foi removido para <strong>{projectName}</strong>.',
        },
        secret_rotated: {
          text: 'Segredo do webhook renovado para {projectName}.',
          intro: 'O segredo do webhook foi renovado para <strong>{projectName}</strong>.',
        },
        enabled: {
          text: 'Webhook ativado para {projectName}.',
          intro: 'Um webhook foi ativado para <strong>{projectName}</strong>.',
        },
        disabled: {
          text: 'Webhook desativado para {projectName}.',
          intro: 'Um webhook foi desativado para <strong>{projectName}</strong>.',
        },
        status_updated: {
          text: 'Status do webhook atualizado para {projectName}.',
          intro: 'O status do webhook foi atualizado para <strong>{projectName}</strong>.',
        },
      },
      endpoint: 'Endpoint: {endpoint}',
    },
    post: {
      subject: '{projectName}: {title}',
      htmlTitle: 'Nova publicação do projeto',
      published:
        '<strong>{projectName}</strong> publicou uma nova atualização: <strong>{title}</strong>',
      publishedText: '{projectName} publicou uma nova atualização: {title}',
      read: 'Ler publicação',
    },
    reply: {
      subject: '{projectName} respondeu à sua mensagem',
      text: '{projectName} respondeu: {preview}\nLer: {threadUrl}',
      intro: '<strong>{projectName}</strong> respondeu à sua mensagem:',
      view: 'Ver conversa',
    },
  },
} as const satisfies Record<EmailLocale, EmailCopy>;

export function resolveEmailLocale(value?: string | null): EmailLocale {
  if (!value) return 'en-GB';
  const normalized = value.trim().toLowerCase();
  const exact = EMAIL_LOCALES.find((locale) => locale.toLowerCase() === normalized);
  if (exact) return exact;
  const language = normalized.split('-')[0] ?? '';
  return (
    EMAIL_LOCALES.find((locale) => (locale.split('-')[0] ?? '').toLowerCase() === language) ??
    'en-GB'
  );
}

export function emailCopy(value?: string | null): EmailCopy {
  return emailMessages[resolveEmailLocale(value)];
}

export function formatEmailDate(value: string, locale?: string | null): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(resolveEmailLocale(locale), {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(date);
}

export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (_, key: string) =>
    String(values[key] ?? `{${key}}`),
  );
}
