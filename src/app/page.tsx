import { socialLinks } from "@/content/social-links";
import { PAGE_BG } from "@/content/stage";
import { PhysicsCanvas } from "@/components/physics-canvas";

export default function Page() {
  return (
    <main className="h-dvh overflow-hidden" style={{ backgroundColor: PAGE_BG }}>
      <PhysicsCanvas links={socialLinks} />
    </main>
  );
}
