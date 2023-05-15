module.exports = {
    menuOptions: {
        inline_keyboard: [
            [
                {text: "1", callback_data: "1"},
                {text: "2", callback_data: "2"},
                {text: "3", callback_data: "3"},
            ],
            [
                {text: "4", callback_data: "4"},
                {text: "5", callback_data: "5"},
                {text: "6", callback_data: "6"},
            ],
            [
                {text: "<", callback_data: "<"},
                {text: ">", callback_data: ">"},
            ],
        ],
        resize_keyboard: true,
    },
    houseDetailOption: {
        inline_keyboard: [
            [{text: 'Открыть в kufar.by', url: 'https://www.kufar.by/',},]
        ],
    },
    mainButtons: {
        reply_markup: JSON.stringify({
            keyboard: [
                [{text: "Покупка"}, {text: "Аренда"}, {text: "Посуточно"}],
            ],
            resize_keyboard: true,
        }),
    }
};
