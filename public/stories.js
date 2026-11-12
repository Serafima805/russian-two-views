// The built-in starter story. The "New story" button asks the server for more.
export const CAFE_STORY = {
  id: "cafe",
  title_ru: "Встреча в кафе",
  title_en: "Meeting at the café",
  scene_en: "Anya and Maxim are students. They planned to meet at a café. Something went wrong.",
  characters: {
    a: {
      name: "Аня",
      gender: "female",
      emoji: "👩",
      role_en: "a student",
      voice: "coral",
      narrative_ru:
        "Привет! Меня зовут Аня. Я студентка. В пятницу я написала Максиму сообщение. " +
        "Я написала: «Давай встретимся в кафе „Луна“ в три часа». " +
        "Я пришла в кафе в три. Я заказала чай. Я ждала Максима. Я ждала один час. " +
        "Максим не пришёл. Я позвонила ему, но он не ответил. Потом я пошла домой. Мне было грустно.",
      suggested: [
        { ru: "Во сколько ты пришла в кафе?", en: "What time did you come to the café?" },
        { ru: "Что ты заказала?", en: "What did you order?" },
        { ru: "Сколько ты ждала?", en: "How long did you wait?" },
        { ru: "Ты позвонила Максиму?", en: "Did you call Maxim?" },
      ],
    },
    b: {
      name: "Максим",
      gender: "male",
      emoji: "👨",
      role_en: "a student",
      voice: "ash",
      narrative_ru:
        "Привет! Я Максим. Я тоже студент. В пятницу Аня написала мне сообщение. " +
        "Я прочитал: «Давай встретимся в кафе „Луна“ в пять часов». " +
        "В три часа я был в библиотеке. Мой телефон был в рюкзаке. " +
        "В пять я пришёл в кафе. Я заказал кофе. Ани там не было. Я ждал полчаса. " +
        "Потом я увидел, что Аня звонила. Я не понимаю, что случилось!",
      suggested: [
        { ru: "Во сколько ты пришёл в кафе?", en: "What time did you come to the café?" },
        { ru: "Где ты был в три часа?", en: "Where were you at three o'clock?" },
        { ru: "Что ты заказал?", en: "What did you order?" },
        { ru: "Где был твой телефон?", en: "Where was your phone?" },
      ],
    },
  },
  differences_en: [
    "Time in the message: Anya says she wrote 3 o'clock; Maxim says he read 5 o'clock.",
    "Arrival: Anya came to the café at 3; Maxim came at 5, so they were never there at the same time.",
    "Order: Anya ordered tea; Maxim ordered coffee.",
    "Waiting: Anya waited one hour; Maxim waited half an hour.",
    "The phone call: Anya called, but Maxim didn't answer because he was in the library and his phone was in his backpack.",
  ],
};
