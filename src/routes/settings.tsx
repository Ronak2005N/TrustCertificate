import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/common/PageHeader";
import { HashDisplay } from "@/components/common/HashDisplay";
import { NetworkStatus } from "@/components/common/NetworkStatus";
import { PrototypeNotice } from "@/components/common/PrototypeNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NETWORK, ORGANIZATION } from "@/lib/demo-data";
import { explorerAddress } from "@/lib/certificates";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Organization settings — Certiproof" },
      {
        name: "description",
        content:
          "Manage issuer identity, certificate branding, blockchain network configuration and notification preferences.",
      },
      { property: "og:title", content: "Organization settings — Certiproof" },
      { property: "og:description", content: "Issuer identity, branding and network settings." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [name, setName] = useState(ORGANIZATION.name);
  const [website, setWebsite] = useState(`https://${ORGANIZATION.domain}`);
  const [signatory, setSignatory] = useState(ORGANIZATION.signatory);
  const [footer, setFooter] = useState(
    "Verify this certificate at certiproof.app/verify using the certificate hash or QR code.",
  );

  return (
    <DashboardShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Settings"
          description="Issuer identity, certificate branding and blockchain configuration."
        />

        <Tabs defaultValue="organization">
          <TabsList>
            <TabsTrigger value="organization">Organization</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="blockchain">Blockchain</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="organization" className="mt-5 space-y-4">
            <Card title="Issuer identity" description="Shown on every certificate you issue.">
              <div className="space-y-1.5">
                <Label htmlFor="org">Organization name</Label>
                <Input id="org" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="site">Website</Label>
                <Input id="site" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sign">Authorised signatory</Label>
                <Input id="sign" value={signatory} onChange={(e) => setSignatory(e.target.value)} />
              </div>
              <SaveButton />
            </Card>
          </TabsContent>

          <TabsContent value="branding" className="mt-5 space-y-4">
            <Card title="Certificate branding" description="Applies to the PDF and the shareable page.">
              <div className="space-y-1.5">
                <Label htmlFor="footer">Certificate footer text</Label>
                <Textarea
                  id="footer"
                  rows={3}
                  value={footer}
                  onChange={(e) => setFooter(e.target.value)}
                />
              </div>
              <ToggleRow
                label="Show QR code on certificate"
                description="Recipients and employers can scan straight into verification."
                defaultChecked
              />
              <ToggleRow
                label="Show organization seal"
                description="Adds the institutional seal above the signature line."
                defaultChecked
              />
              <SaveButton />
            </Card>
          </TabsContent>

          <TabsContent value="blockchain" className="mt-5 space-y-4">
            <NetworkStatus detailed />
            <Card title="Registry configuration" description="Where certificate hashes are anchored.">
              <HashDisplay label="Registry contract" value={NETWORK.contract} />
              <HashDisplay label="Issuer wallet" value={ORGANIZATION.wallet} />
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Network</dt>
                  <dd className="text-foreground">{NETWORK.name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Chain ID</dt>
                  <dd className="font-mono text-foreground">{NETWORK.chainId}</dd>
                </div>
              </dl>
              <Button asChild variant="outline">
                <a href={explorerAddress(NETWORK.contract)} target="_blank" rel="noreferrer">
                  View contract on explorer
                </a>
              </Button>
              <PrototypeNotice />
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="mt-5 space-y-4">
            <Card title="Notifications" description="Alerts sent to your issuing team.">
              <ToggleRow
                label="Email recipient on issuance"
                description="Sends the verification link when a certificate is anchored."
                defaultChecked
              />
              <ToggleRow
                label="Weekly verification digest"
                description="Summary of verification checks against your certificates."
                defaultChecked
              />
              <ToggleRow
                label="Alert on revocation"
                description="Notify all admins whenever a certificate is revoked."
              />
              <SaveButton />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-6 shadow-soft">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function ToggleRow({
  label,
  description,
  defaultChecked = false,
}: {
  label: string;
  description: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border bg-muted/30 p-4">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch defaultChecked={defaultChecked} aria-label={label} />
    </div>
  );
}

function SaveButton() {
  return (
    <Button onClick={() => toast.success("Settings saved")} className="w-fit">
      Save changes
    </Button>
  );
}
