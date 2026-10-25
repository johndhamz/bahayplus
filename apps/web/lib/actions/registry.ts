"use server";

import { revalidatePath } from "next/cache";
import * as assets from "@bahayplus/modules/assets";
import * as files from "@bahayplus/modules/files";
import * as pets from "@bahayplus/modules/pets";
import * as vehicles from "@bahayplus/modules/vehicles";
import type { ServiceContext } from "@bahayplus/modules/authorization";
import { fromResult, type ActionResult } from "@bahayplus/types/action-result";
import type { Result } from "@bahayplus/types/result";
import { getServiceContext } from "@/lib/auth/context";

/** Wraps a module command as a Server Action: auth context → service → revalidate → ActionResult. */
async function run<T>(fn: (ctx: ServiceContext) => Promise<Result<T>>, message: string): Promise<ActionResult<T>> {
  const ctx = await getServiceContext();
  if (!ctx)
    return { ok: false, error: { code: "UNAUTHENTICATED", message: "Your session has ended. Please sign in again." } };
  const result = await fn(ctx);
  if (result.ok) revalidatePath("/app/h/[householdId]", "layout");
  return fromResult(result, message);
}

export const createAssetAction = async (i: unknown) => run((c) => assets.createAsset(c, i), "Item added.");
export const updateAssetAction = async (i: unknown) => run((c) => assets.updateAsset(c, i), "Item saved.");
export const archiveAssetAction = async (i: unknown) => run((c) => assets.archiveAsset(c, i), "Item archived.");
export const restoreAssetAction = async (i: unknown) => run((c) => assets.restoreAsset(c, i), "Item restored.");
export const addAssetServiceRecordAction = async (i: unknown) =>
  run((c) => assets.addAssetServiceRecord(c, i), "Record added.");
export const deleteAssetServiceRecordAction = async (i: unknown) =>
  run((c) => assets.deleteAssetServiceRecord(c, i), "Record deleted.");

export const createPetAction = async (i: unknown) => run((c) => pets.createPet(c, i), "Pet added.");
export const updatePetAction = async (i: unknown) => run((c) => pets.updatePet(c, i), "Pet saved.");
export const archivePetAction = async (i: unknown) => run((c) => pets.archivePet(c, i), "Pet archived.");
export const restorePetAction = async (i: unknown) => run((c) => pets.restorePet(c, i), "Pet restored.");
export const setPetPhotoAction = async (i: unknown) => run((c) => pets.setPetPhoto(c, i), "Photo updated.");
export const addPetHealthRecordAction = async (i: unknown) =>
  run((c) => pets.addPetHealthRecord(c, i), "Record added.");
export const deletePetHealthRecordAction = async (i: unknown) =>
  run((c) => pets.deletePetHealthRecord(c, i), "Record deleted.");

export const createVehicleAction = async (i: unknown) => run((c) => vehicles.createVehicle(c, i), "Vehicle added.");
export const updateVehicleAction = async (i: unknown) => run((c) => vehicles.updateVehicle(c, i), "Vehicle saved.");
export const archiveVehicleAction = async (i: unknown) =>
  run((c) => vehicles.archiveVehicle(c, i), "Vehicle archived.");
export const restoreVehicleAction = async (i: unknown) =>
  run((c) => vehicles.restoreVehicle(c, i), "Vehicle restored.");
export const addVehicleServiceRecordAction = async (i: unknown) =>
  run((c) => vehicles.addVehicleServiceRecord(c, i), "Record added.");
export const deleteVehicleServiceRecordAction = async (i: unknown) =>
  run((c) => vehicles.deleteVehicleServiceRecord(c, i), "Record deleted.");

export const prepareUploadAction = async (i: unknown) => run((c) => files.prepareUpload(c, i), "Ready to upload.");
export const registerFileAction = async (i: unknown) => run((c) => files.registerFile(c, i), "File uploaded.");
export const deleteFileAction = async (i: unknown) => run((c) => files.deleteFile(c, i), "File deleted.");
