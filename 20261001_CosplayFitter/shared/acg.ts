export interface AcgCharacter {
  id: string;
  name: string;
  aliases: readonly string[];
  costume: string;
}

export interface AcgTopic {
  id: string;
  label: string;
  malAnimeId: number;
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
];

export function getTopic(id: string): AcgTopic | undefined {
  return ACG_TOPICS.find((topic) => topic.id === id);
}

export function getCharacter(topicId: string, characterId: string): AcgCharacter | undefined {
  return getTopic(topicId)?.characters.find((character) => character.id === characterId);
}
