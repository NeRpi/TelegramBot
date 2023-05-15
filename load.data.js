const axios = require("axios");
const fs = require("fs");
const cheerio = require("cheerio");
const nodeHtmlToImage = require("node-html-to-image");
const {defaults} = require("axios");
const {houseDetailOption} = require("./options");

const TypesRent = {
    sell: ["Покупка", "&typ=sell"], rent: ["Аренда", "&rnt=1&typ=let"], daily: ["Посуточно", "&rnt=2&typ=let"],
};

class LoadData {
    constructor(url, typeRent) {
        this.baseUrl = url;
        this.url = this.baseUrl;
        this.data = [];
        this.prevPageUrl = null;
        this.nextPageUrl = null;
        this.pageUrl = null;
        this.curentCat = 1010;
        this.sizePage = 6;
        this.currentPage = 0;
        this.currentType = typeRent;
        this.url = this.baseUrl + this.currentType[1];
        this.filterUrl = '';
        this.countData = null;
    }

    setFiltering(data) {
        if (Object.keys(data).length === 0) return;
        if (data?.cat) {
            this.baseUrl = this.baseUrl.replace(`cat=${this.curentCat}`, data.cat.urlValue);
            this.curentCat = data.cat.urlValue;
        }
        this.filterUrl = Object.values(data).slice(1, -1).filter(item => item !== null).map(value => value.urlValue).join('&');
        this.url = this.baseUrl + (this.pageUrl ? `&cursor=${this.pageUrl}&` : "&") + this.filterUrl + this.currentType[1];
    }

    setType(newType) {
        this.currentType = newType;
        this.url = this.baseUrl + (this.pageUrl ? `&cursor=${this.pageUrl}&` : "&") + this.filterUrl + this.currentType[1];
        this.currentPage = 0;
        this.data = [];
    }

    async getData() {
        await axios
            .get(this.url)
            .then((response) => {
                this.data = response.data.ads;
                this.prevPageUrl = response.data?.pagination.pages.find(page => page.label === 'prev')?.token
                this.nextPageUrl = response.data?.pagination.pages.find(page => page.label === 'next')?.token;
            })
            .catch((error) => {
                console.log(error);
            });
    }

    async getCountData() {
        if (this.countData !== null) return this.countData;
        const countUrl = 'https://api.kufar.by/search-api/v1/search/count' + this.url.substring(this.url.indexOf('?'));
        await axios.get(countUrl).then((response) => {
            this.countData = response.data?.count;
        }).catch((error) => {
            console.log(error);
        });
        return this.countData;
    }

    async getHouseImages(selectHouseId) {
        if (this.data.length === 0) await this.getData();
        const selectHouse = this.data[this.currentPage * this.sizePage + selectHouseId - 1];
        const selectHouseImagesUrls = selectHouse?.images.map(image => {
            return `https://yams.kufar.by/api/v1/kufar-ads/images/${image.id.toString().slice(0, 2)}/${image.id}.jpg?rule=list_thumbs_2x`;
        });

        const html = fs.readFileSync("./htmls/houseDetail.html", "utf-8");
        const houseDetail = cheerio.load(html);

        houseDetail("div.image-grid").css('grid-template-columns', `repeat(${Math.ceil(Math.sqrt(selectHouseImagesUrls.length))}, 1fr)`);
        selectHouseImagesUrls.forEach((imageUrl) => {
            houseDetail("div.image-grid").append(`<img src="${imageUrl}" alt="Не удалось загрузить изображения">`);
        });

        await nodeHtmlToImage({output: "./houseDetail.png", html: houseDetail.html()});
    }

    async getHouseDetail(selectHouseId) {
        if (this.data.length === 0) await this.getData();
        const selectHouse = this.data[this.currentPage * this.sizePage + selectHouseId - 1];
        let houseParameters = selectHouse?.ad_parameters.slice(4, -2);

        const addersHouse = selectHouse?.account_parameters.find((e) => e?.pu === "ad").v;
        const locationsHouse = selectHouse?.ad_parameters.find((e) => e.pu === "gbx").v;
        const price = (Number(selectHouse?.price_byn) / 100).toLocaleString("ru-RU", {
            style: "currency", currency: "BYN",
        });

        houseDetailOption.inline_keyboard[0][0].url = selectHouse?.ad_link;
        const locationsHouseUrl = `https://www.google.com/maps/place/${locationsHouse[1]},${locationsHouse[0]}`;

        let houseDetail = "1. Адрес: " + `<a href="${locationsHouseUrl}">${addersHouse}</a>` + "\n2. Цена: " + price;
        houseParameters.forEach((parameter) => (parameter.vl = Array.isArray(parameter?.vl || parameter?.v) ? (parameter?.vl || parameter?.v).join(", ") : parameter?.vl || parameter?.v));
        houseParameters.forEach((parameter, index) => (houseDetail += "\n" + (index + 3) + ". " + parameter?.pl + ": " + parameter.vl.toString().toLowerCase()));

        return houseDetail;
    }

    pageTransition(data) {
        if (data === ">") this.currentPage++;
        else if (data === "<") this.currentPage--;
        if (this.currentPage < 0) {
            this.pageUrl = this.prevPageUrl;
            this.currentPage = Math.floor(30 / this.sizePage) - 1;
            this.data = [];
        } else if (this.currentPage >= Math.floor(30 / this.sizePage)) {
            this.pageUrl = this.nextPageUrl;
            this.currentPage = 0;
            this.data = [];
        }
    }

    async getMenuDescription() {
        if (this.data.length === 0) await this.getData();
        let description = `По вашему запросу было найдено ${await this.getCountData()} предложений\n\nВыберите интересующее вас предложение:\n`;
        this.data
            .slice(this.currentPage * this.sizePage, (this.currentPage + 1) * this.sizePage)
            .forEach((house, index) => {
                let price = (Number(house?.price_byn) / 100).toLocaleString("ru-RU", {
                    style: "currency", currency: "BYN",
                });
                description += index + 1 + ". Адресс: " + house?.account_parameters.find((e) => e?.pu === "ad").v + "\nЦена: " + price + "\n";
            });

        return description;
    }

    async getMenuImage() {
        if (this.data.length === 0) await this.getData();
        const imageUrls = this.data
            .slice(this.currentPage * this.sizePage, (this.currentPage + 1) * this.sizePage)
            .map((house) => {
                if (house.images.length === 0) return "";
                return `https://yams.kufar.by/api/v1/kufar-ads/images/${house.images[0].id
                    .toString()
                    .slice(0, 2)}/${house.images[0].id}.jpg?rule=list_thumbs_2x`;
            });

        const html = fs.readFileSync("./htmls/menuImages.html", "utf-8");
        const menuImages = cheerio.load(html);
        menuImages("h1.type-title").text(this.currentType[0]);

        imageUrls.forEach((imageUrl) => {
            menuImages("div.image-grid").append(`<img src="${imageUrl}" alt="Не удалось загрузить изображения">`);
        });

        await nodeHtmlToImage({output: "./menuImage.png", html: menuImages.html()});
    }
}

module.exports = {LoadData, TypesRent};
