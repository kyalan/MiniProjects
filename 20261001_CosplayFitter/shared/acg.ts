export interface AcgCharacter {
  id: string;
  name: string;
  aliases: readonly string[];
  costume: string;
  previewPage?: string;
  previewFile?: string;
}

export interface AcgTopic {
  id: string;
  label: string;
  series?: string;
  malAnimeId?: number;
  wikiApi?: string;
  characters: readonly AcgCharacter[];
}

export const ACG_TOPICS: readonly AcgTopic[] = [
  {
    id: "one_piece",
    label: "One Piece",
    malAnimeId: 21,
    characters: [
      {
        id: "luffy",
        name: "Monkey D. Luffy",
        aliases: ["Monkey D. Luffy"],
        costume: "a straw hat on a red cord, an open red vest, blue shorts, and sandals",
      },
      {
        id: "zoro",
        name: "Roronoa Zoro",
        aliases: ["Roronoa Zoro"],
        costume: "a green haramaki, a black bandana, and three swords worn at the hip",
      },
      {
        id: "nami",
        name: "Nami",
        aliases: ["Nami"],
        costume: "orange hair, a blue-and-white striped top, and a long staff with an orange motif",
      },
      {
        id: "usopp",
        name: "Usopp",
        aliases: ["Usopp"],
        costume: "curly hair, striped overalls, goggles on the forehead, and a slingshot",
      },
      {
        id: "sanji",
        name: "Sanji",
        aliases: ["Sanji", "Vinsmoke Sanji"],
        costume: "blond hair covering one eye, a black suit, a tie, and polished dress shoes",
      },
      {
        id: "chopper",
        name: "Tony Tony Chopper",
        aliases: ["Tony Tony Chopper"],
        costume: "a large pink hat marked with a white cross, and blue shorts",
      },
      {
        id: "robin",
        name: "Nico Robin",
        aliases: ["Nico Robin"],
        costume: "long black hair, a purple cowboy hat, and a long dark coat",
      },
      {
        id: "franky",
        name: "Franky",
        aliases: ["Franky"],
        costume: "a bright blue pompadour, an open Hawaiian shirt, and metal forearms marked with stars",
      },
      {
        id: "brook",
        name: "Brook",
        aliases: ["Brook"],
        costume: "an afro wig, a formal black suit, a top hat, and a slender cane",
      },
      {
        id: "jinbe",
        name: "Jinbe",
        aliases: ["Jinbe", "Jinbei"],
        costume: "a patterned open robe in sea blue, a black belt, and a wave motif along the hem",
      },
      {
        id: "law",
        name: "Trafalgar Law",
        aliases: ["Trafalgar Law", "Trafalgar D. Water Law"],
        costume: "a white hat with dark spots and a long black coat covered in the same spots",
      },
      {
        id: "ace",
        name: "Portgas D. Ace",
        aliases: ["Portgas D. Ace"],
        costume: "an orange hat hung with red beads, an open shirt, and a knife at the belt",
      },
      {
        id: "sabo",
        name: "Sabo",
        aliases: ["Sabo"],
        costume: "a top hat, goggles, a blue coat with gold buttons, and a metal pipe",
      },
      {
        id: "hancock",
        name: "Boa Hancock",
        aliases: ["Boa Hancock"],
        costume: "long black hair, gold snake earrings, a red cape, and a red-and-white qipao",
      },
      {
        id: "shanks",
        name: "Shanks",
        aliases: ["Shanks", "Red-Haired Shanks", "Akagami no Shanks"],
        costume: "red hair, a dark cloak over a loose shirt, and a sword at the hip",
      },
      {
        id: "mihawk",
        name: "Dracule Mihawk",
        aliases: ["Dracule Mihawk"],
        costume: "a wide black hat with a feather, a dark coat, a cross pendant, and one oversized sword",
      },
      {
        id: "doflamingo",
        name: "Donquixote Doflamingo",
        aliases: ["Donquixote Doflamingo"],
        costume: "blond hair, pink-tinted sunglasses, and a long pink coat edged with feathers",
      },
      {
        id: "yamato",
        name: "Yamato",
        aliases: ["Yamato"],
        costume: "long white hair, a red-and-white kimono top, horn ornaments, and a large spiked club",
      },
      {
        id: "kid",
        name: "Eustass Kid",
        aliases: ["Eustass Kid", "Eustass Kidd"],
        costume: "spiky red hair, goggles, a coat with a fur collar, and a metal arm",
      },
      {
        id: "kaido",
        name: "Kaido",
        aliases: ["Kaido", "Kaidou"],
        costume: "horns, an open purple vest with a scale pattern, and a huge spiked club",
      },
    ],
  },
  {
    id: "chiikawa",
    label: "Chiikawa",
    malAnimeId: 50250,
    characters: [
      {
        id: "chiikawa",
        name: "Chiikawa",
        aliases: ["Chiikawa"],
        costume: "a tiny round white body, pink cheeks, small ears, and a simple pale look",
      },
      {
        id: "hachiware",
        name: "Hachiware",
        aliases: ["Hachiware"],
        costume: "a white body with a grey split across the face, grey cat-like ears, and a simple pale look",
      },
      {
        id: "usagi",
        name: "Usagi",
        aliases: ["Usagi"],
        costume: "a yellow body, long upright ears, a wide mouth, and a thin stick of grass held in one hand",
      },
      {
        id: "momonga",
        name: "Momonga",
        aliases: ["Momonga"],
        costume: "a pink flying-squirrel body, a pale membrane cape between the arms, and small ears",
      },
      {
        id: "rakko",
        name: "Rakko",
        aliases: ["Rakko"],
        costume: "a brown sea-otter body, a yellow work jacket, and a tool held ready for labor",
      },
      {
        id: "kurimanju",
        name: "Kurimanju",
        aliases: ["Kuri-manjuu", "Kurimanju"],
        costume: "a round brown chestnut-bun body, a cracked chestnut top, and small limbs",
      },
      {
        id: "shisa",
        name: "Shisa",
        aliases: ["Shiisaa", "Shisa"],
        costume: "a small Okinawan lion-dog body, a curly mane, and a blue-white coat",
      },
      {
        id: "furuhonya",
        name: "Furuhonya",
        aliases: ["Furuhonya"],
        costume: "a small bookseller look, a simple shop apron, and a stack of old books",
      },
      {
        id: "kabutomushi",
        name: "Kabutomushi",
        aliases: ["Kabutomushi"],
        costume: "a rhinoceros-beetle body, a horn on the head, and a dark brown shell",
      },
      {
        id: "pochette_armor",
        name: "Pochette armor",
        aliases: ["Poshetto no Yoroi-san"],
        costume: "a tiny suit of pale plate armor that fits in a small pouch, with a closed visor",
      },
      {
        id: "ramen_armor",
        name: "Ramen armor",
        aliases: ["Ramen no Yoroi-san"],
        costume: "a tiny suit of armor and a ramen bowl carried as the signature prop",
      },
      {
        id: "pajama_leader",
        name: "Pajama Parties leader",
        aliases: ["Pyjama Parties Leader"],
        costume: "bright pajamas, a party bow, and the look of someone leading a pajama party",
      },
    ],
  },
  {
    id: "jungle",
    label: "Jungle",
    series: "Jumanji: Welcome to the Jungle (2017)",
    wikiApi: "https://jumanji.fandom.com/api.php",
    characters: [
      {
        id: "bravestone",
        name: "Dr. Smolder Bravestone",
        aliases: ["Smolder Bravestone", "Dr. Xander Bravestone"],
        costume: "a khaki adventure shirt, a brown leather vest, khaki trousers, boots, and a belt with a holster",
        previewPage: "Smolder Bravestone",
      },
      {
        id: "ruby",
        name: "Ruby Roundhouse",
        aliases: ["Ruby Roundhouse"],
        costume: "a short olive top, khaki shorts, combat boots, and a high ponytail",
        previewPage: "Ruby Roundhouse",
      },
      {
        id: "finbar",
        name: 'Franklin "Mouse" Finbar',
        aliases: ["Franklin Finbar", "Mouse Finbar", "Franklin \"Mouse\" Finbar"],
        costume: "a khaki zoologist shirt, a utility vest, shorts, glasses, and a backpack",
        previewPage: 'Franklin "Mouse" Finbar',
      },
      {
        id: "oberon",
        name: "Professor Shelly Oberon",
        aliases: ["Shelly Oberon", "Sheldon Oberon", "Professor Sheldon Oberon"],
        costume: "a cream shirt, khaki shorts, glasses, boots, and a map case",
        previewPage: "Shelly Oberon",
      },
      {
        id: "seaplane",
        name: 'Jefferson "Seaplane" McDonough',
        aliases: ["Seaplane McDonough", "Jefferson McDonough"],
        costume: "a brown leather flight jacket, an aviator scarf, goggles, and a pilot cap",
        previewPage: "Seaplane McDonough",
      },
      {
        id: "nigel",
        name: "Nigel Billingsley",
        aliases: ["Nigel Billingsley"],
        costume: "a khaki safari suit and a pith helmet",
        previewPage: "Nigel Billingsley",
      },
      {
        id: "van_pelt",
        name: "Russell Van Pelt",
        aliases: ["Russell Van Pelt", "Van Pelt"],
        costume: "a dark hunter coat, a wide hat, and a leather belt",
        previewPage: "Russell Van Pelt",
      },
    ],
  },
  {
    id: "desert",
    label: "Desert",
    series: "Dune (2021)",
    wikiApi: "https://dune.fandom.com/api.php",
    characters: [
      {
        id: "paul",
        name: "Paul Atreides",
        aliases: ["Paul Atreides", "Muad'Dib"],
        costume: "a dark Atreides jacket with a high collar, or a desert stillsuit under a sand-colored cloak",
        previewFile: "Dune Character Poster - Paul.jpeg",
      },
      {
        id: "jessica",
        name: "Lady Jessica",
        aliases: ["Lady Jessica", "Jessica Atreides"],
        costume: "a long dark gown with a sheer veil, or a stillsuit under a dark cloak",
        previewFile: "Dune Character Poster - Lady Jessica.jpeg",
      },
      {
        id: "chani",
        name: "Chani",
        aliases: ["Chani", "Chani Kynes"],
        costume: "a Fremen stillsuit, a sand-colored wrap, and blue eye lenses",
        previewFile: "Dune Character Poster - Chani.jpeg",
      },
      {
        id: "leto",
        name: "Duke Leto Atreides",
        aliases: ["Duke Leto Atreides", "Leto Atreides"],
        costume: "a dark Atreides military uniform and a long cape",
        previewFile: "Dune Character Poster - Duke Leto.jpeg",
      },
      {
        id: "duncan",
        name: "Duncan Idaho",
        aliases: ["Duncan Idaho"],
        costume: "Atreides armor, a dark cloak, and long hair",
        previewFile: "Dune Character Poster - Duncan Idaho.jpeg",
      },
      {
        id: "gurney",
        name: "Gurney Halleck",
        aliases: ["Gurney Halleck"],
        costume: "Atreides battle armor and a dark cloak",
        previewFile: "Dune Character Poster - Gurney.jpeg",
      },
      {
        id: "stilgar",
        name: "Stilgar",
        aliases: ["Stilgar"],
        costume: "a Fremen stillsuit, a desert robe, and blue eye lenses",
        previewFile: "Dune Character Poster - Stilgar.jpeg",
      },
      {
        id: "baron",
        name: "Baron Vladimir Harkonnen",
        aliases: ["Vladimir Harkonnen", "Baron Harkonnen"],
        costume: "heavy black robes",
        previewFile: "Dune Character Poster - Baron Harkonnen.jpeg",
      },
      {
        id: "rabban",
        name: "Glossu Rabban",
        aliases: ["Glossu Rabban", "Beast Rabban"],
        costume: "black Harkonnen armor",
        previewFile: "Dune Character Poster - Beast Rabban.webp",
      },
      {
        id: "kynes",
        name: "Dr. Liet Kynes",
        aliases: ["Liet Kynes", "Liet-Kynes", "Dr. Liet-Kynes"],
        costume: "a stillsuit and a desert cloak",
        previewFile: "Dune Character Poster - Liet Kynes.webp",
      },
      {
        id: "mohiam",
        name: "Reverend Mother Mohiam",
        aliases: ["Gaius Helen Mohiam", "Reverend Mother Gaius Helen Mohiam"],
        costume: "a black robe and a full veil",
        previewFile: "Dune Character Poster - Reverend Mother Mohiam.webp",
      },
      {
        id: "yueh",
        name: "Dr. Wellington Yueh",
        aliases: ["Wellington Yueh", "Dr. Yueh"],
        costume: "a dark Suk doctor coat with a diamond mark on the forehead",
        previewFile: "Dune Character Poster - Dr Yueh.webp",
      },
      {
        id: "thufir",
        name: "Thufir Hawat",
        aliases: ["Thufir Hawat"],
        costume: "dark Mentat robes",
        previewFile: "Dune Character Poster - Thufir Hawat.webp",
      },
      {
        id: "piter",
        name: "Piter De Vries",
        aliases: ["Piter De Vries"],
        costume: "dark Harkonnen Mentat robes",
        previewFile: "Dune Character Poster - Piter De Vries.webp",
      },
    ],
  },
];

export function getTopic(id: string): AcgTopic | undefined {
  return ACG_TOPICS.find((topic) => topic.id === id);
}

export function getCharacter(topicId: string, characterId: string): AcgCharacter | undefined {
  return getTopic(topicId)?.characters.find((character) => character.id === characterId);
}
