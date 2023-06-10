import Color from 'color'

function toRgbString(color) {
    color = new Color(color)
    return `${color.red()}, ${color.green()}, ${color.blue()}`
}

export class Theme {
    backgroundColor: string
    foregroundColor: string
    foregroundColorRgb: string
    themeColor: string
    themeColorRgb: string

    constructor(backgroundColor, foregroundColor, themeColor) {
        this.backgroundColor = backgroundColor
        this.foregroundColor = foregroundColor
        this.foregroundColorRgb = toRgbString(foregroundColor)
        this.themeColor = themeColor
        this.themeColorRgb = toRgbString(themeColor)
        console.log(themeColor, this.themeColorRgb)
    }
}

export const DefaultBrightTheme = new Theme('white', 'black', '#e9266a')
export const DefaultDarkTheme = new Theme('#000628', 'white', '#e9266a')