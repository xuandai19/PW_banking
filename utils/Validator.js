class Validator {

    static isEmpty(value) {

        return value === undefined ||
               value === null ||
               value.trim() === "";

    }

    static isNumber(value) {

        return !isNaN(value);

    }

    static isPositiveNumber(value) {

        return !isNaN(value) &&
               Number(value) > 0;

    }

    static isPhone(phone) {

        return /^0\d{9}$/.test(phone);

    }

    static minLength(value, length) {

        return value.length >= length;

    }

}

module.exports = Validator;