import { CheckCircle2 } from "lucide-react";

import { AuthHeader, AuthPanel } from "../../_components/AuthPrimitives";

export default function DeviceAuthorizationSuccessPage() {
  return (
    <AuthPanel>
      <div className="mb-5 flex justify-center text-[#00CEC9]">
        <CheckCircle2 className="size-12" />
      </div>
      <AuthHeader
        eyebrow="Devion CLI"
        title="Gerät autorisiert"
        description="Du kannst dieses Browserfenster jetzt schließen und in der CLI fortfahren."
      />
    </AuthPanel>
  );
}
