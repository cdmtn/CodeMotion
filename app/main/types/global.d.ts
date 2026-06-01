import type { LoginPayload, RegisterPayload, SaveContentPayload } from "../payloads"

export interface ElectronAPI {
    askToSaveNewFile: (
        properties: SaveContentPayload
    ) => Promise<any>
}