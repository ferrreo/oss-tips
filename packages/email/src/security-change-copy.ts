import { resolveEmailLocale, type EmailLocale } from './i18n.js';

export const SECURITY_CHANGE_ACTIONS = [
  'profile_updated',
  'passkey_removed',
  'session_revoked',
  'sessions_revoked',
  'account_unlinked',
  'discord_linked',
  'discord_unlinked',
] as const;

export type SecurityChangeAction = (typeof SECURITY_CHANGE_ACTIONS)[number];

const labels: Record<EmailLocale, Record<SecurityChangeAction, string>> = {
  'en-GB': {
    profile_updated: 'Your profile was updated.',
    passkey_removed: 'A passkey was removed from your account.',
    session_revoked: 'A session was signed out.',
    sessions_revoked: 'Your other sessions were signed out.',
    account_unlinked: 'A connected sign-in account was removed.',
    discord_linked: 'Discord was connected to a project.',
    discord_unlinked: 'Discord was disconnected from a project.',
  },
  de: {
    profile_updated: 'Dein Profil wurde aktualisiert.',
    passkey_removed: 'Ein Passkey wurde aus deinem Konto entfernt.',
    session_revoked: 'Eine Sitzung wurde abgemeldet.',
    sessions_revoked: 'Deine anderen Sitzungen wurden abgemeldet.',
    account_unlinked: 'Ein verbundenes Anmeldekonto wurde entfernt.',
    discord_linked: 'Discord wurde mit einem Projekt verbunden.',
    discord_unlinked: 'Discord wurde von einem Projekt getrennt.',
  },
  fr: {
    profile_updated: 'Votre profil a été mis à jour.',
    passkey_removed: 'Une clé d’accès a été supprimée de votre compte.',
    session_revoked: 'Une session a été déconnectée.',
    sessions_revoked: 'Vos autres sessions ont été déconnectées.',
    account_unlinked: 'Un compte de connexion associé a été supprimé.',
    discord_linked: 'Discord a été associé à un projet.',
    discord_unlinked: 'Discord a été dissocié d’un projet.',
  },
  es: {
    profile_updated: 'Tu perfil se actualizó.',
    passkey_removed: 'Se eliminó una clave de acceso de tu cuenta.',
    session_revoked: 'Se cerró una sesión.',
    sessions_revoked: 'Se cerraron tus otras sesiones.',
    account_unlinked: 'Se eliminó una cuenta de inicio de sesión conectada.',
    discord_linked: 'Discord se conectó a un proyecto.',
    discord_unlinked: 'Discord se desconectó de un proyecto.',
  },
  'pt-BR': {
    profile_updated: 'Seu perfil foi atualizado.',
    passkey_removed: 'Uma chave de acesso foi removida da sua conta.',
    session_revoked: 'Uma sessão foi encerrada.',
    sessions_revoked: 'Suas outras sessões foram encerradas.',
    account_unlinked: 'Uma conta de login conectada foi removida.',
    discord_linked: 'O Discord foi conectado a um projeto.',
    discord_unlinked: 'O Discord foi desconectado de um projeto.',
  },
};

export function securityChangeLabel(action: SecurityChangeAction, locale?: string | null): string {
  return labels[resolveEmailLocale(locale)][action];
}
