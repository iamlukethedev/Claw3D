import { BuilderController } from "../../../composition/BuilderController";
import { readVisualRuntimeConfig } from "../../../composition/config";

export const dynamic = "force-dynamic";

export default function BuilderPage() {
  const config = readVisualRuntimeConfig(process.env);
  return <BuilderController persistenceEnabled={config.persistenceEnabled} />;
}
