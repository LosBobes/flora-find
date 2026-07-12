import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { DESC_TRANSLATIONS_SR, NAME_TRANSLATIONS_SR } from './contentTranslations'

const LANG_KEY = 'florafind_lang'

export const LANGUAGES = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'sr', label: 'SR', name: 'Srpski' },
]

const MONTHS = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  sr: ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'],
}

const MONTHS_SHORT = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  sr: ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'],
}

// Replace em dashes (never allowed) in displayed free-text with a comma.
function stripEmDash(text) {
  return typeof text === 'string' ? text.replace(/\s*—\s*/g, ', ') : text
}

// Serbian has three plural forms; pick the right noun for a count.
function srPlural(n, one, few, many) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

const STRINGS = {
  en: {
    // Top bar / search
    searchPlaceholder: 'Search plants, fruits, notes…',
    allCategories: 'All categories',
    allTypes: 'All types',
    inSeason: 'In season',
    inSeasonTitle: 'Only show plants currently in season or bloom',
    hi: ({ username }) => `Hi, ${username}`,
    admin: 'admin',
    logOut: 'Log out',
    logIn: 'Log in',
    register: 'Register',
    language: 'Language',

    // Sidebar
    cancelAdding: 'Cancel adding',
    registerPlant: 'Register a plant',
    clickToPlace: 'Click on the map where the plant grows.',
    locating: 'Locating…',
    leaveNearMe: 'Leave near me',
    nearMe: 'Near me',
    exportArea: 'Export area',
    cancelExport: 'Cancel export',
    dragToSelect: 'Drag a rectangle on the map to select an area.',
    dragToSelectNotice: 'Drag a rectangle on the map to select the area to export.',
    plantsCount: ({ count }) => `${count} plant${count === 1 ? '' : 's'}`,
    plantNoun: ({ count }) => (count === 1 ? 'plant' : 'plants'),
    withinKm: ({ km }) => ` within ${km} km`,
    matchingSuffix: ' matching',
    inViewSuffix: ' in view',
    emptyList: 'Nothing here yet. Register the first plant!',

    // List item tooltips
    tipHazard: 'Poisonous / hazardous',
    tipInSeason: 'In season now',
    tipGone: 'Reported gone',

    // Details
    hazardFlag: 'Poisonous / hazardous: do not touch or eat',
    goneFlag: ({ count }) => `Reported gone by ${count} ${count === 1 ? 'person' : 'people'}`,
    fruitLabel: 'Fruit:',
    typeLabel: 'Type:',
    bloomsLabel: 'Blooms:',
    seasonLabel: 'Season:',
    bloomingBadge: 'Blooming',
    inSeasonBadge: 'In season',
    distanceLabel: 'Distance:',
    learnMore: 'Learn more',
    registeredBy: ({ user, date }) => `Registered by ${user} on ${date}`,
    lastConfirmed: ({ when }) => `Last confirmed ${when}`,
    unknown: 'unknown',
    today: 'today',
    yesterday: 'yesterday',
    daysAgo: ({ days }) => `${days} days ago`,
    stillThere: 'Still there',
    gone: 'Gone',
    edit: 'Edit',
    delete: 'Delete',
    confirmDelete: ({ name }) => `Delete “${name}”?`,

    // Form
    editPlant: 'Edit plant',
    formPreview: 'Live preview',
    formTapHint: 'Pick a category, then fill in the details 🌱',
    category: 'Category',
    name: 'Name',
    namePlaceholder_fruit_tree: 'e.g. Old cherry by the school',
    namePlaceholder_tree: 'e.g. Big oak in the park',
    namePlaceholder_shrub: 'e.g. Lilac hedge on the corner',
    namePlaceholder_flowerbed: 'e.g. Tulip bed by the fountain',
    namePlaceholder_vine: 'e.g. Wisteria over the gate',
    namePlaceholder_other: 'e.g. Herb patch by the path',
    fruit: 'Fruit',
    plantType: 'Plant type',
    selectTypePlaceholder: 'Select a type…',
    noTypesYet: 'No types in this category yet.',
    addNewType: 'Add a new type',
    newTypePanelTitle: 'New plant type',
    typeNameForLang: ({ language }) => `Name (${language})`,
    addTypeAction: 'Add type',
    hazardCheckbox: 'Poisonous or hazardous (e.g. poison ivy): warn people',
    species: 'Species',
    optional: '(optional)',
    speciesFruitPlaceholder: 'e.g. Prunus avium',
    speciesPlaceholder: 'e.g. Quercus robur',
    season: 'Season',
    bloomingSeason: 'Blooming season',
    from: 'From…',
    to: 'To…',
    notes: 'Notes',
    notesPlaceholder: 'Access, ripeness, anything useful…',
    photos: ({ max }) => `Photos (optional, up to ${max})`,
    saving: 'Saving…',
    save: 'Save',
    cancel: 'Cancel',

    // Auth
    logInTitle: 'Log in',
    createAccount: 'Create an account',
    email: 'Email',
    username: 'Username',
    password: 'Password',
    pleaseWait: 'Please wait…',
    noAccount: 'No account?',
    alreadyRegistered: 'Already registered?',

    // Export
    exportAreaTitle: 'Export area',
    selectedRectangle: 'Selected rectangle:',
    format: 'Format',
    exporting: 'Exporting…',
    download: 'Download',
    exportedNotice: ({ count, format }) => `Exported ${count} plant${count === 1 ? '' : 's'} as ${format}`,
    adminsOnly: 'Admins only. Export is not available.',

    // Areas
    drawArea: 'Draw area',
    cancelArea: 'Cancel drawing',
    drawAreaNotice: 'Click on the map to outline an area. Add at least 3 points, then Finish.',
    drawAreaProgress: ({ count }) => `${count} point${count === 1 ? '' : 's'}`,
    undoPoint: 'Undo point',
    finishArea: 'Finish',
    nameArea: 'Name this area',
    editArea: 'Edit area',
    areaFormHint: 'Describe what grows across this area 🌿',
    areaBadge: 'Area',
    areaSavedNotice: ({ name }) => `Saved area “${name}”`,
    areaUpdated: 'Area updated',
    areaDeleted: 'Area deleted',

    // Layers
    layers: 'Layers',
    layerAll: 'All',
    layerPlants: 'Plants',
    layerAreas: 'Areas',

    // Notices
    registeredNotice: ({ name }) => `Registered “${name}”`,
    photoUploadFailed: ({ message }) => `Plant saved, but photo upload failed: ${message}`,
    plantUpdated: 'Plant updated',
    plantDeleted: 'Plant deleted',
    geolocationUnsupported: 'Geolocation is not supported by this browser',
    locationError: ({ message }) => `Could not get your location: ${message}`,
    thanksConfirming: 'Thanks for confirming!',
    thanksReporting: 'Noted, thanks for reporting.',

    togglePlantList: 'Toggle plant list',

    // Map settings
    mapSettings: 'Map settings',
    mapTheme: 'Map theme',
    themeMono: 'Mono',
    themeLight: 'Light',
    themeVoyager: 'Voyager',
    themeStardew: 'Stardew',
    themeDark: 'Dark',
    markerSize: 'Marker size',
    sizeSmall: 'S',
    sizeMedium: 'M',
    sizeLarge: 'L',
    showLabels: 'Show labels',

    // Nav / dock / mobile
    filters: 'Filters',
    account: 'Account',
    menu: 'Menu',
    close: 'Close',
    tagline: 'Neighbourhood plants, mapped by people like you.',
    listSheetTitle: 'Plants',

    // Category labels
    cat_fruit_tree: 'Fruit tree',
    cat_tree: 'Tree',
    cat_shrub: 'Shrub / bush',
    cat_flowerbed: 'Flowerbed',
    cat_vine: 'Vine / climber',
    cat_other: 'Other plant',

    // PWA install
    installTitle: 'Install FloraFind',
    installBody: 'Add FloraFind to your home screen for a full-screen, app-like experience, even offline.',
    installAction: 'Install app',
    installLater: 'Not now',
    installIosBody: 'Install FloraFind on your iPhone or iPad:',
    installIosStep1: 'Tap the Share button in Safari',
    installIosStep2: 'Choose “Add to Home Screen”',
    installIosStep3: 'Tap “Add” to finish',
    installedTitle: 'FloraFind is installed 🎉',
    installedBody: 'Launch it any time from your home screen.',
    updateReady: 'A new version of FloraFind is ready.',
    updateAction: 'Refresh',

    // Interactive tutorial
    tourStart: 'Take a tour',
    tourSkip: 'Skip',
    tourBack: 'Back',
    tourNext: 'Next',
    tourDone: 'Got it',
    tourStepOf: ({ current, total }) => `Step ${current} of ${total}`,
    helpTitle: 'How FloraFind works',
    tourWelcomeTitle: 'Welcome to FloraFind 🌿',
    tourWelcomeBody: 'A living map of the plants around you, built by the community. This quick tour shows you the essentials.',
    tourSearchTitle: 'Search anything',
    tourSearchBody: 'Look up a plant, a fruit, or a note. Results come from across the whole map.',
    tourRegisterTitle: 'Add a plant',
    tourRegisterBody: 'Spotted a fruit tree or a flowerbed? Drop a pin and share it with your neighbours.',
    tourNearMeTitle: 'Find what’s nearby',
    tourNearMeBody: 'Tap “Near me” to centre the map on your location and see what’s growing around you.',
    tourFiltersTitle: 'Filter the map',
    tourFiltersBody: 'Narrow things down by category, plant type, or show only what’s in season right now.',
    tourFinishTitle: 'You’re all set!',
    tourFinishBody: 'Explore the map, confirm plants you find, and help the map grow. You can reopen this tour any time from the help button.',
    tourInstallCta: 'Install the app',
  },

  sr: {
    // Top bar / search
    searchPlaceholder: 'Pretraži biljke, plodove, beleške…',
    allCategories: 'Sve kategorije',
    allTypes: 'Svi tipovi',
    inSeason: 'U sezoni',
    inSeasonTitle: 'Prikaži samo biljke koje su trenutno u sezoni ili cvetaju',
    hi: ({ username }) => `Zdravo, ${username}`,
    admin: 'admin',
    logOut: 'Odjava',
    logIn: 'Prijava',
    register: 'Registracija',
    language: 'Jezik',

    // Sidebar
    cancelAdding: 'Otkaži dodavanje',
    registerPlant: 'Dodaj biljku',
    clickToPlace: 'Klikni na mapu gde biljka raste.',
    locating: 'Lociranje…',
    leaveNearMe: 'Napusti „blizu mene“',
    nearMe: 'Blizu mene',
    exportArea: 'Izvezi oblast',
    cancelExport: 'Otkaži izvoz',
    dragToSelect: 'Prevuci pravougaonik na mapi da izabereš oblast.',
    dragToSelectNotice: 'Prevuci pravougaonik na mapi da izabereš oblast za izvoz.',
    plantsCount: ({ count }) => `${count} ${srPlural(count, 'biljka', 'biljke', 'biljaka')}`,
    plantNoun: ({ count }) => srPlural(count, 'biljka', 'biljke', 'biljaka'),
    withinKm: ({ km }) => ` u krugu od ${km} km`,
    matchingSuffix: ' po pretrazi',
    inViewSuffix: ' u prikazu',
    emptyList: 'Još ništa ovde. Dodaj prvu biljku!',

    // List item tooltips
    tipHazard: 'Otrovno / opasno',
    tipInSeason: 'Trenutno u sezoni',
    tipGone: 'Prijavljeno da je nestala',

    // Details
    hazardFlag: 'Otrovno / opasno: ne dirati i ne jesti',
    goneFlag: ({ count }) => `${count} ${srPlural(count, 'osoba je', 'osobe su', 'osoba je')} prijavilo da je nestala`,
    fruitLabel: 'Plod:',
    typeLabel: 'Tip:',
    bloomsLabel: 'Cveta:',
    seasonLabel: 'Sezona:',
    bloomingBadge: 'Cveta',
    inSeasonBadge: 'U sezoni',
    distanceLabel: 'Udaljenost:',
    learnMore: 'Saznaj više',
    registeredBy: ({ user, date }) => `Dodao/la ${user}, ${date}`,
    lastConfirmed: ({ when }) => `Poslednja potvrda ${when}`,
    unknown: 'nepoznato',
    today: 'danas',
    yesterday: 'juče',
    daysAgo: ({ days }) => `pre ${days} ${srPlural(days, 'dan', 'dana', 'dana')}`,
    stillThere: 'Još je tu',
    gone: 'Nema je',
    edit: 'Izmeni',
    delete: 'Obriši',
    confirmDelete: ({ name }) => `Obrisati „${name}“?`,

    // Form
    editPlant: 'Izmeni biljku',
    formPreview: 'Pregled uživo',
    formTapHint: 'Izaberi kategoriju, pa popuni detalje 🌱',
    category: 'Kategorija',
    name: 'Naziv',
    namePlaceholder_fruit_tree: 'npr. Stara trešnja kod škole',
    namePlaceholder_tree: 'npr. Veliki hrast u parku',
    namePlaceholder_shrub: 'npr. Živica jorgovana na ćošku',
    namePlaceholder_flowerbed: 'npr. Leja lala kod fontane',
    namePlaceholder_vine: 'npr. Glicinija nad kapijom',
    namePlaceholder_other: 'npr. Leja začina uz stazu',
    fruit: 'Plod',
    plantType: 'Tip biljke',
    selectTypePlaceholder: 'Izaberi tip…',
    noTypesYet: 'Još nema tipova u ovoj kategoriji.',
    addNewType: 'Dodaj novi tip',
    newTypePanelTitle: 'Novi tip biljke',
    typeNameForLang: ({ language }) => `Naziv (${language})`,
    addTypeAction: 'Dodaj tip',
    hazardCheckbox: 'Otrovno ili opasno (npr. otrovni bršljan): upozori druge',
    species: 'Vrsta',
    optional: '(opciono)',
    speciesFruitPlaceholder: 'npr. Prunus avium',
    speciesPlaceholder: 'npr. Quercus robur',
    season: 'Sezona',
    bloomingSeason: 'Sezona cvetanja',
    from: 'Od…',
    to: 'Do…',
    notes: 'Beleške',
    notesPlaceholder: 'Pristup, zrelost, bilo šta korisno…',
    photos: ({ max }) => `Fotografije (opciono, do ${max})`,
    saving: 'Čuvanje…',
    save: 'Sačuvaj',
    cancel: 'Otkaži',

    // Auth
    logInTitle: 'Prijava',
    createAccount: 'Napravi nalog',
    email: 'Email',
    username: 'Korisničko ime',
    password: 'Lozinka',
    pleaseWait: 'Sačekajte…',
    noAccount: 'Nemaš nalog?',
    alreadyRegistered: 'Već imaš nalog?',

    // Export
    exportAreaTitle: 'Izvoz oblasti',
    selectedRectangle: 'Izabrani pravougaonik:',
    format: 'Format',
    exporting: 'Izvoz…',
    download: 'Preuzmi',
    exportedNotice: ({ count, format }) => `Izvezeno ${count} ${srPlural(count, 'biljka', 'biljke', 'biljaka')} kao ${format}`,
    adminsOnly: 'Samo za administratore. Izvoz nije dostupan.',

    // Areas
    drawArea: 'Nacrtaj oblast',
    cancelArea: 'Otkaži crtanje',
    drawAreaNotice: 'Klikni na mapu da ocrtaš oblast. Dodaj bar 3 tačke, pa Završi.',
    drawAreaProgress: ({ count }) => `${count} ${srPlural(count, 'tačka', 'tačke', 'tačaka')}`,
    undoPoint: 'Poništi tačku',
    finishArea: 'Završi',
    nameArea: 'Imenuj oblast',
    editArea: 'Izmeni oblast',
    areaFormHint: 'Opiši šta raste na ovoj oblasti 🌿',
    areaBadge: 'Oblast',
    areaSavedNotice: ({ name }) => `Sačuvana oblast „${name}“`,
    areaUpdated: 'Oblast je ažurirana',
    areaDeleted: 'Oblast je obrisana',

    // Layers
    layers: 'Slojevi',
    layerAll: 'Sve',
    layerPlants: 'Biljke',
    layerAreas: 'Oblasti',

    // Notices
    registeredNotice: ({ name }) => `Dodato „${name}“`,
    photoUploadFailed: ({ message }) => `Biljka je sačuvana, ali otpremanje fotografija nije uspelo: ${message}`,
    plantUpdated: 'Biljka je ažurirana',
    plantDeleted: 'Biljka je obrisana',
    geolocationUnsupported: 'Ovaj pregledač ne podržava geolokaciju',
    locationError: ({ message }) => `Nije moguće utvrditi lokaciju: ${message}`,
    thanksConfirming: 'Hvala na potvrdi!',
    thanksReporting: 'Zabeleženo, hvala na prijavi.',

    togglePlantList: 'Prikaži listu biljaka',

    // Map settings
    mapSettings: 'Podešavanja mape',
    mapTheme: 'Tema mape',
    themeMono: 'Mono',
    themeLight: 'Svetla',
    themeVoyager: 'Voyager',
    themeStardew: 'Stardew',
    themeDark: 'Tamna',
    markerSize: 'Veličina oznaka',
    sizeSmall: 'S',
    sizeMedium: 'M',
    sizeLarge: 'L',
    showLabels: 'Prikaži nazive',

    // Nav / dock / mobile
    filters: 'Filteri',
    account: 'Nalog',
    menu: 'Meni',
    close: 'Zatvori',
    tagline: 'Biljke iz kraja, na mapi koju prave ljudi poput tebe.',
    listSheetTitle: 'Biljke',

    // Category labels
    cat_fruit_tree: 'Voćka',
    cat_tree: 'Drvo',
    cat_shrub: 'Žbun / grm',
    cat_flowerbed: 'Cvetna leja',
    cat_vine: 'Puzavica',
    cat_other: 'Druga biljka',

    // PWA install
    installTitle: 'Instaliraj FloraFind',
    installBody: 'Dodaj FloraFind na početni ekran za doživljaj kao prava aplikacija, preko celog ekrana, čak i van mreže.',
    installAction: 'Instaliraj aplikaciju',
    installLater: 'Ne sada',
    installIosBody: 'Instaliraj FloraFind na iPhone ili iPad:',
    installIosStep1: 'Dodirni dugme za deljenje u Safariju',
    installIosStep2: 'Izaberi „Add to Home Screen“',
    installIosStep3: 'Dodirni „Add“ da završiš',
    installedTitle: 'FloraFind je instaliran 🎉',
    installedBody: 'Pokreni ga bilo kada sa početnog ekrana.',
    updateReady: 'Spremna je nova verzija FloraFind-a.',
    updateAction: 'Osveži',

    // Interactive tutorial
    tourStart: 'Kreni u obilazak',
    tourSkip: 'Preskoči',
    tourBack: 'Nazad',
    tourNext: 'Dalje',
    tourDone: 'Razumem',
    tourStepOf: ({ current, total }) => `Korak ${current} od ${total}`,
    helpTitle: 'Kako FloraFind radi',
    tourWelcomeTitle: 'Dobrodošli u FloraFind 🌿',
    tourWelcomeBody: 'Živa mapa biljaka oko tebe, koju stvara zajednica. Ovaj kratki obilazak pokazuje osnovne stvari.',
    tourSearchTitle: 'Pretraži bilo šta',
    tourSearchBody: 'Potraži biljku, plod ili belešku. Rezultati stižu sa cele mape.',
    tourRegisterTitle: 'Dodaj biljku',
    tourRegisterBody: 'Primetio si voćku ili cvetnu leju? Postavi oznaku i podeli je sa komšijama.',
    tourNearMeTitle: 'Pronađi šta je u blizini',
    tourNearMeBody: 'Dodirni „Blizu mene“ da centriraš mapu na svoju lokaciju i vidiš šta raste oko tebe.',
    tourFiltersTitle: 'Filtriraj mapu',
    tourFiltersBody: 'Suzi izbor po kategoriji, tipu biljke, ili prikaži samo ono što je trenutno u sezoni.',
    tourFinishTitle: 'Sve je spremno!',
    tourFinishBody: 'Istražuj mapu, potvrđuj biljke koje nađeš i pomozi da mapa raste. Obilazak možeš ponovo otvoriti dugmetom za pomoć.',
    tourInstallCta: 'Instaliraj aplikaciju',
  },
}

const I18nContext = createContext(null)

function detectLang() {
  const stored = localStorage.getItem(LANG_KEY)
  if (stored === 'en' || stored === 'sr') return stored
  return navigator.language?.toLowerCase().startsWith('sr') ? 'sr' : 'en'
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectLang)

  const setLang = useCallback((next) => {
    localStorage.setItem(LANG_KEY, next)
    setLangState(next)
  }, [])

  const t = useCallback(
    (key, vars) => {
      const value = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key
      return typeof value === 'function' ? value(vars ?? {}) : value
    },
    [lang],
  )

  // Localise a plant's free-text name / description. Only the seeded demo
  // content is translated; user-entered text falls back to the original.
  // The SR lookup uses the raw English value as its key, so we translate first
  // and strip em dashes from the OUTPUT (never use em dashes anywhere).
  const name = useCallback(
    (value) => {
      if (!value) return value
      const out = lang === 'en' ? value : NAME_TRANSLATIONS_SR[value] ?? value
      return stripEmDash(out)
    },
    [lang],
  )
  const desc = useCallback(
    (value) => {
      if (!value) return value
      const out = lang === 'en' ? value : DESC_TRANSLATIONS_SR[value] ?? value
      return stripEmDash(out)
    },
    [lang],
  )

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t,
      name,
      desc,
      months: MONTHS[lang],
      monthsShort: MONTHS_SHORT[lang],
    }),
    [lang, setLang, t, name, desc],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}
