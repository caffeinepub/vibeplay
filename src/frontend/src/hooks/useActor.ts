/**
 * Local useActor wrapper for VibePlay.
 *
 * Wires the app's generated `createActor` from `backend.ts` into the
 * `@caffeineai/core-infrastructure` useActor hook so downstream hooks
 * (useAuth, useUserData) get a typed Backend actor.
 */
import { useActor as useActorBase } from "@caffeineai/core-infrastructure";
import { type Backend, createActor } from "../backend";

export function useActor() {
  // createActor matches the createActorFunction<Backend> signature
  return useActorBase<Backend>(createActor);
}
