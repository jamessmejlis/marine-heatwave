/**
 * NZ coastal regions for Marine Heatwave Live NZ.
 *
 * Coordinates are on or near the NOAA OISST v2.1 quarter-degree grid
 * (centres at .125/.375/.625/.875). Same coords are used for both the
 * Open-Meteo live SST fetch and the marineheatwaves.org tracker
 * climatology download, so the two datasets describe the same pixel.
 */

export type Region = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Māori/alternate name, shown as subtitle when present */
  altName?: string;
  /** One-line locator for humans (appears under region name) */
  locator: string;
};

export const regions: Region[] = [
  {
    id: "northland",
    name: "Northland",
    altName: "Te Tai Tokerau",
    locator: "Off Bay of Islands",
    lat: -35.125,
    lon: 174.125,
  },
  {
    id: "hauraki-gulf",
    name: "Hauraki Gulf",
    altName: "Tīkapa Moana",
    locator: "Off Auckland",
    lat: -36.375,
    lon: 174.875,
  },
  {
    id: "coromandel",
    name: "Coromandel",
    locator: "Off Coromandel township",
    lat: -36.7587,
    lon: 175.4981,
  },
  {
    id: "bay-of-plenty",
    name: "Bay of Plenty",
    altName: "Te Moana-a-Toi",
    locator: "Off Ōpōtiki",
    lat: -37.975,
    lon: 177.275,
  },
  {
    id: "east-cape",
    name: "East Cape",
    locator: "East of Te Araroa",
    lat: -37.625,
    lon: 178.625,
  },
  {
    id: "hawkes-bay",
    name: "Hawke's Bay / Wairarapa",
    altName: "Te Matau-a-Māui",
    locator: "Off Napier",
    lat: -39.625,
    lon: 177.625,
  },
  {
    id: "marlborough-sounds",
    name: "Marlborough Sounds",
    locator: "Pelorus Sound",
    lat: -41.1628,
    lon: 173.8632,
  },
  {
    id: "golden-bay",
    name: "Golden Bay",
    altName: "Mohua",
    locator: "Mid-bay",
    lat: -40.6548,
    lon: 172.821,
  },
  {
    id: "kaikoura",
    name: "Kaikōura / East Coast South",
    locator: "East of Kaikōura",
    lat: -42.625,
    lon: 173.875,
  },
  {
    id: "otago",
    name: "Otago",
    locator: "East of the peninsula",
    lat: -45.875,
    lon: 170.875,
  },
  {
    id: "fiordland",
    name: "Fiordland",
    altName: "Te Rua-o-te-Moko",
    locator: "West of Milford",
    lat: -45.625,
    lon: 166.125,
  },
  {
    id: "foveaux-strait",
    name: "Foveaux Strait",
    altName: "Te Ara-a-Kiwa",
    locator: "Between Bluff and Stewart Island",
    lat: -46.625,
    lon: 168.125,
  },
];

export function regionById(id: string): Region | undefined {
  return regions.find((r) => r.id === id);
}
