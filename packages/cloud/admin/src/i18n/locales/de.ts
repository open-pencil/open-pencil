import type { CloudTranslations } from '../types'

export default {
  common: {
    productName: 'OpenPencil Cloud',
    cancel: 'Abbrechen',
    back: 'Zurück',
    retry: 'Erneut versuchen',
    refresh: 'Neu laden',
    search: 'Suche',
    loading: 'Wird geladen ...',
    signOut: 'Abmelden',
    noResults: 'Keine Ergebnisse',
    optional: 'optional',
    status: 'Status',
    actions: 'Maßnahmen',
    attempts: '{count} Versuche',
    noError: 'Fehler Nr.',
    userRole: 'Nutzer',
    administratorRole: 'Administrator',
    primaryNavigation: 'Hauptnavigation',
    administrationNavigation: 'Administration',
    cloudCapabilities: 'Cloud-Funktionen',
    language: 'Sprache',
    theme: 'Darstellung',
    themeLight: 'Hell',
    themeDark: 'Dunkel',
    themeSystem: 'System'
  },
  public: {
    homeTitle: 'Gemeinsam gestalten – überall',
    homeDescription:
      'Teilen Sie OpenPencil-Dateien, arbeiten Sie live zusammen und organisieren Sie jede Version in einem Arbeitsbereich.',
    localFirstLabel: 'Ein gemeinsamer Ort für Ihre Designs',
    openEditor: 'Editor öffnen',
    openCloud: 'Cloud öffnen',
    notFoundTitle: 'Seite nicht gefunden',
    notFoundDescription: 'Die angeforderte Seite existiert nicht.',
    backHome: 'Zurück zu Cloud',
    localFirstTitle: 'Live-Zusammenarbeit',
    localFirstDescription:
      'Arbeiten Sie gemeinsam am selben Design und sehen Sie Änderungen sofort.',
    portableTitle: 'Sofort teilen',
    portableDescription: 'Laden Sie Teammitglieder ein oder senden Sie einen sicheren Link.',
    sharingTitle: 'Versionsverlauf',
    sharingDescription: 'Bewahren Sie jede gespeicherte Version Ihres Designs zuverlässig auf.'
  },
  auth: {
    signIn: 'Anmelden',
    signUp: 'Registrieren',
    signInTitle: 'Willkommen zurück',
    signUpTitle: 'Konto erstellen',
    signInDescription:
      'Fahren Sie mit einem für diese Cloud-Instanz konfigurierten Identitätsanbieter fort.',
    signUpDescription: 'Erstellen Sie ein Konto mit einer verifizierten Identität.',
    approvalDisclosure: 'Neue Konten werden von einem Administrator geprüft.',
    haveAccount: 'Sie haben bereits ein Konto?',
    needAccount: 'Neu bei OpenPencil Cloud?',
    continueGoogle: 'Weiter mit Google',
    continueApple: 'Weiter mit Apple',
    openingProvider: '{provider} wird geöffnet…',
    noProviders: 'Für diese Cloud-Instanz ist kein Social-Media-Anmeldeanbieter konfiguriert.',
    forbiddenTitle: 'Zugriff des Bereitstellungsadministrators erforderlich',
    forbiddenDescription:
      'Ihr Konto ist angemeldet, hat aber keinen Zugriff auf den Bereitstellungsadministrator.'
  },
  account: {
    pendingTitle: 'Ihr Konto wartet auf Genehmigung',
    pendingDescription:
      'Ein Administrator dieser OpenPencil Cloud-Instanz muss Ihr Konto genehmigen.',
    checkAgain: 'Erneut prüfen',
    rejectedTitle: 'Ihre Kontoanfrage wurde abgelehnt',
    rejectedDescription: 'Diese Cloud-Instanz hat Ihre Kontoanfrage nicht genehmigt.',
    revokedTitle: 'Ihr Cloud-Zugriff wurde entzogen',
    revokedDescription:
      'Wenden Sie sich an einen Administrator, wenn Sie dies für einen Fehler halten.',
    readyLabel: 'Cloud ist bereit',
    dashboardTitle: 'Ihr OpenPencil Cloud-Arbeitsbereich',
    dashboardDescription:
      'Öffnen Sie den Editor, um Cloud-Dokumente zu erstellen, zu synchronisieren und zu teilen.',
    workspacesTitle: 'Arbeitsbereiche',
    workspaceRole: 'Rolle: {role}',
    noWorkspacesTitle: 'Noch keine Cloud-Arbeitsbereiche',
    noWorkspacesDescription:
      'Öffnen Sie den Editor, um Ihren ersten Cloud-Arbeitsbereich zu erstellen.'
  },
  admin: {
    enrollment: 'Zugriffsanfragen',
    enrollmentDescription:
      'Prüfen Sie Zugriffsanfragen. Erst nach der Genehmigung wird ein Konto bereitgestellt.',
    users: 'Benutzer',
    email: 'E-Mail',
    emailDescription:
      'Zustellungs- und Wiederholungsstatus. Vertrauliche Inhalte werden nicht angezeigt.',
    audit: 'Audit-Protokoll',
    operations: 'Betrieb',
    filterEnrollment: 'Zugriffsstatus filtern',
    allStatuses: 'Alle Status',
    statusPending: 'Ausstehend',
    statusApproved: 'Genehmigt',
    statusRejected: 'Abgelehnt',
    statusRevoked: 'Widerrufen',
    requested: 'Angefragt',
    reason: 'Grund',
    approve: 'Genehmigen',
    reject: 'Ablehnen',
    revoke: 'Widerrufen',
    noEnrollments: 'Keine Zugriffsanfragen.',
    searchUsers: 'Benutzer nach E-Mail-Adresse suchen',
    makeAdmin: 'Zum Administrator machen',
    removeAdmin: 'Administratorrolle entfernen',
    revokeSessions: 'Sitzungen widerrufen',
    ban: 'Sperren',
    unban: 'Entsperren',
    regenerate: 'Neu erzeugen',
    noEmailMessages: 'Keine Transaktions-E-Mails.',
    noAuditEvents: 'Keine Audit-Ereignisse.',
    revokeTitle: 'Cloud-Zugriff widerrufen?',
    rejectTitle: 'Zugriffsanfrage ablehnen?',
    banTitle: 'Benutzer sperren?',
    removeAdminTitle: 'Administratorrolle entfernen?',
    confirmationReason: 'Grund',
    deployment: 'Bereitstellung',
    enrollmentMode: 'Zugriffsmodus',
    emailTransport: 'E-Mail-Transport',
    pendingEnrollment: 'Ausstehende Zugriffsanfragen',
    pendingEmail: 'Ausstehende E-Mails',
    failedEmail: 'Fehlgeschlagene E-Mails'
  },
  errors: {
    network:
      'Cloud konnte nicht erreicht werden. Überprüfen Sie Ihre Verbindung und versuchen Sie es erneut.',
    timeout: 'Cloud hat zu lange gebraucht, um zu antworten. Versuchen Sie es erneut.',
    protocol:
      'Cloud hat eine ungültige Antwort zurückgegeben. Wenden Sie sich an den Support, wenn dies weiterhin der Fall ist.',
    authenticationRequired: 'Ihre Sitzung ist abgelaufen. Bitte nochmals anmelden.',
    authorizationRequired: 'Der Zugriff des Bereitstellungsadministrators ist erforderlich.',
    invalidEnrollmentTransition:
      'Dieser Registrierungsstatus hat sich geändert. Aktualisieren und erneut versuchen.',
    lastAdminRequired: 'Mindestens ein aktiver Bereitstellungsadministrator ist erforderlich.',
    selfActionForbidden: 'Sie können diese Aktion nicht auf eigene Rechnung durchführen.',
    emailRegenerationUnavailable:
      'Diese E-Mail kann nicht aus aktuellen Datensätzen wiederhergestellt werden.',
    unknown: 'Etwas ist schief gelaufen. Versuch es noch einmal.',
    signInCancelled: 'Die Anmeldung wurde abgebrochen oder abgelehnt.',
    enrollmentClosed: 'Die Cloud-Anmeldung ist derzeit abgeschlossen.',
    providerError:
      'Der Identitätsanbieter konnte die Anmeldung nicht abschließen. Versuchen Sie es erneut.',
    configUnavailable: 'Cloud-Konfiguration ist nicht verfügbar',
    configUnavailableDescription:
      'Der Bereitstellungsadministrator muss diese Cloud-Instanz korrigieren.'
  },
  head: {
    homeTitle: 'OpenPencil Cloud',
    homeDescription:
      'Optionale, lokale Arbeitsbereiche, Dokumentrevisionen, Freigabe und Zusammenarbeit.',
    signInTitle: 'Anmelden',
    signInDescription: 'Bei OpenPencil Cloud anmelden.',
    signUpTitle: 'Konto erstellen',
    signUpDescription: 'Ein OpenPencil Cloud-Konto erstellen.',
    pendingTitle: 'Warten auf Genehmigung',
    pendingDescription:
      'Ihr OpenPencil Cloud-Konto wartet auf die Genehmigung eines Administrators.',
    rejectedTitle: 'Anfrage abgelehnt',
    rejectedDescription: 'Ihre OpenPencil Cloud-Kontoanfrage wurde abgelehnt.',
    revokedTitle: 'Zugriff entzogen',
    revokedDescription: 'Ihr OpenPencil Cloud-Zugriff wurde entzogen.',
    dashboardTitle: 'Cloud-Arbeitsbereich',
    dashboardDescription: 'Öffnen Sie Ihren OpenPencil Cloud-Arbeitsbereich.',
    notFoundTitle: 'Seite nicht gefunden',
    notFoundDescription: 'Die angeforderte OpenPencil Cloud-Seite wurde nicht gefunden.',
    enrollmentTitle: 'Immatrikulation',
    enrollmentDescription: 'Überprüfen Sie die Einschreibung von OpenPencil Cloud.',
    usersTitle: 'Benutzer',
    usersDescription: 'Verwalten Sie OpenPencil Cloud-Benutzer.',
    emailTitle: 'Email',
    emailDescription: 'Überprüfen Sie die Zustellung von Transaktions-E-Mails.',
    auditTitle: 'Prüfung',
    auditDescription: 'Überprüfen Sie Bereitstellungsverwaltungsereignisse.',
    operationsTitle: 'Betriebsabläufe',
    operationsDescription: 'Überprüfen Sie den Zustand der OpenPencil Cloud-Bereitstellung.',
    forbiddenTitle: 'Administratorzugriff erforderlich',
    forbiddenDescription: 'Der Zugriff des Bereitstellungsadministrators ist erforderlich.'
  }
} satisfies CloudTranslations
