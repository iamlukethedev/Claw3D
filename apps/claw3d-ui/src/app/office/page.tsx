import { VisualRuntimeController } from "../../composition/VisualRuntimeController";
import { readVisualRuntimeConfig } from "../../composition/config";

export const dynamic = "force-dynamic";

export default function OfficePage() {
  const config = readVisualRuntimeConfig(process.env);
  return (
    <VisualRuntimeController
      configuredAdapter={config.adapter}
      persistenceEnabled={config.persistenceEnabled}
      configurationReason={config.reason}
    />
  );
}
