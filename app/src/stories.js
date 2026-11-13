/**
 * stories.js — voorbeeldbladzijdes om mee te oefenen (zonder foto).
 * Nieuwe toevoegen? Kopieer een blok en pas het aan.
 *  - hard:     woorden die we extra aandacht geven (lettergrepen in "syllables")
 *  - quiz:     één vraag na het lezen; "answer" = nummer van het goede antwoord (begint bij 0)
 */
export const STORIES = [
  {
    id: "bas-muts",
    title: "Bas en de rode muts",
    level: "groep 3-4",
    text: "Bas de beer zoekt zijn rode muts. Hij kijkt onder het bed. Daar ligt een boek, maar geen muts. Dan hoort hij een geluid in de tuin. De wind blaast de muts hoog in de boom! Bas klimt voorzichtig omhoog. Hebbes!",
    syllables: { geluid: ["ge", "luid"], voorzichtig: ["voor", "zich", "tig"], blaast: ["bl", "aa", "st"] },
    quiz: { question: "Waar was de muts van Bas?", options: ["Onder het bed", "Hoog in de boom", "In de schooltas"], answer: 1 },
  },
  {
    id: "pip-vlinder",
    title: "Pip en de vlinder",
    level: "groep 3-4",
    text: "Pip de kat ligt in de zon. Er vliegt een gele vlinder langs. Pip springt op en rent erachteraan. De vlinder gaat over de schutting. Pip springt ook. Plons! Daar is de vijver. Pip is nat, maar de vlinder lacht.",
    syllables: { vlinder: ["vlin", "der"], schutting: ["schut", "ting"], erachteraan: ["er", "ach", "ter", "aan"] },
    quiz: { question: "Welke kleur had de vlinder?", options: ["Geel", "Blauw", "Rood"], answer: 0 },
  },
  {
    id: "noor-raket",
    title: "Noor bouwt een raket",
    level: "groep 4-5",
    text: "Noor heeft een grote doos gevonden. Ze plakt er een punt op en tekent ramen aan de zijkant. Nu is het een raket! Noor gaat erin zitten en telt af: drie, twee, een. Ze sluit haar ogen en vliegt in gedachten naar de maan. Daar zwaait een vriendelijk mannetje naar haar.",
    syllables: { gevonden: ["ge", "von", "den"], zijkant: ["zij", "kant"], gedachten: ["ge", "dach", "ten"], vriendelijk: ["vrien", "de", "lijk"] },
    quiz: { question: "Waar vliegt Noor naartoe?", options: ["Naar de zon", "Naar de maan", "Naar oma"], answer: 1 },
  },
];
