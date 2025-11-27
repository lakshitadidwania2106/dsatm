import Papa from 'papaparse'
import metroCsv from './delhi_metro.csv?raw'

const { data } = Papa.parse(metroCsv, {
  header: true,
  skipEmptyLines: true,
})

const colors = {
  'Red line': '#c1121f',
  'Yellow line': '#f6c600',
  'Blue line': '#1f63c1',
  'Blue line branch': '#1f63c1',
  'Green line': '#107e4d',
  'Green line branch': '#107e4d',
  'Voilet line': '#6c2f8d',
  'Violet line': '#6c2f8d',
  'Magenta line': '#d0006f',
  'Pink line': '#f08dbb',
  'Orange line': '#f58220',
  'Grey line': '#515659',
  'Gray line': '#515659',
  'Aqua line': '#00a3a1',
  'Rapid Metro': '#0081a0',
}

export const delhiMetroLineColors = colors

export const delhiMetroStations = data
  .map((row) => {
    const latitude = parseFloat(row.Latitude)
    const longitude = parseFloat(row.Longitude)
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return null
    }
    const line = (row['Metro Line'] || '').trim()
    return {
      id: `${line}-${row['ID (Station ID)']}-${row['Station Names']}`,
      name: row['Station Names'],
      distance: row['Dist. From First Station(km)'],
      line,
      layout: row.Layout,
      opened: row['Opened(Year)'],
      latitude,
      longitude,
    }
  })
  .filter(Boolean)


