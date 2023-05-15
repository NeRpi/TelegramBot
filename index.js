const TelegramApi = require("node-telegram-bot-api");
const express = require('express');
const cors = require('cors');
const {mainButtons, menuOptions, houseDetailOption} = require("./options");
const {LoadData, TypesRent} = require("./load.data");

const token = "6131793603:AAHBN8Yxwdc5GrQMZDXSFvzBOreTPOlO67g";
const bot = new TelegramApi(token, {polling: true});
const app = express();

app.use(express.json());
app.use(cors());

kufarWebUrl =
    "https://api.kufar.by/search-api/v1/search/rendered-paginated?cat=1010&gtsy=country-belarus&cur=BYR&size=30";

const messageData = {};
let filtering = {};

bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    let typeRent = null;

    if (text === "/start") {
        await bot.sendMessage(chatId, "Ниже появится кнопка, заполни форму", mainButtons);
    } else if (text === "Покупка") {
        typeRent = TypesRent.sell;
    } else if (text === "Аренда") {
        typeRent = TypesRent.rent;
    } else if (text === "Посуточно") {
        typeRent = TypesRent.daily;
    }

    if (typeRent) {
        const loadData = new LoadData(kufarWebUrl, typeRent);
        loadData.setFiltering(filtering);
        await loadData.getData();
        loadData.getMenuImage().then(async () => {
            await bot.sendPhoto(chatId, './menuImage.png', {
                caption: await loadData.getMenuDescription(),
                reply_markup: menuOptions
            }).then(sendMessage => messageData[sendMessage.message_id] = loadData)
        }).catch(exception => console.log("Get menu image exception: " + exception))
    }
});

bot.on("callback_query", async (query) => {
    const data = query.data;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const loadData = messageData[messageId];

    if (isNaN(data)) {
        loadData.pageTransition(data);
        loadData.getMenuImage().then(async () => {
            bot.sendPhoto(chatId, './menuImage.png', {disable_notification: true}).then(async (newPhoto) => {
                await bot.deleteMessage(chatId, newPhoto.message_id);
                await bot.editMessageMedia({
                    type: 'photo', media: newPhoto.photo.at(-1).file_id, caption: await loadData.getMenuDescription(),
                }, {
                    chat_id: chatId, message_id: messageId, reply_markup: menuOptions
                })
            })
        }).catch(exception => console.log("Get menu image exception: " + exception))
    } else if (Number(data) > 0 && Number(data) <= loadData?.sizePage) {
        loadData.getHouseImages(Number(data)).then(async () => {
            await bot.sendPhoto(chatId, './houseDetail.png', {
                caption: await loadData.getHouseDetail(Number(data)),
                parse_mode: 'HTML',
                reply_markup: houseDetailOption
            })
        })
    }
});

app.post('/web-data', async (req, res) => {
    const {queryId, data} = req.body;
    filtering = data;
    const filteringText = `Были установлены следующие фильтры:\n${Object.keys(data).map(key => data[key].fieldValue + data[key].messageValue.toLowerCase()).join('\n')}`;
    try {
        await bot.answerWebAppQuery(queryId, {
            type: 'article',
            id: queryId,
            title: 'Применение фильтров',
            input_message_content: {
                message_text: filteringText,
            }
        })
        return res.status(200).json({});
    } catch (e) {
        return res.status(500).json({})
    }
})

const PORT = 8000;
app.listen(PORT, () => console.log('server started on PORT ' + PORT))