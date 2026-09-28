"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { api, errorMessage } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ColorField, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

type Initial = {
  site: {
    name: string;
    description: string;
    language: string;
    timezone: string;
    publishHour: number;
    frequency: string;
  };
  brand: { brandVoice: string; keywords: string[] };
  design: {
    primaryColor: string;
    secondaryColor: string;
    surfaceColor: string;
    backgroundColor: string;
    textColor: string;
    mutedColor: string;
    fontStyle: string;
    layoutStyle: string;
    cardStyle: string;
    headerStyle: string;
    heroStyle: string;
    cardDensity: string;
    borderRadius: number;
  } | null;
  settings: { siteTitle: string; metaDescription: string; indexable: boolean };
};

const CONTENT_LANGUAGES = ["en", "ru", "ko", "de", "es", "fr", "ja"];

export function SiteSettingsForm({ siteId, initial }: { siteId: string; initial: Initial }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState(initial.site.name);
  const [description, setDescription] = useState(initial.site.description);
  const [language, setLanguage] = useState(initial.site.language);
  const [timezone, setTimezone] = useState(initial.site.timezone);
  const [brandVoice, setBrandVoice] = useState(initial.brand.brandVoice);
  const [keywords, setKeywords] = useState(initial.brand.keywords.join(", "));
  const [siteTitle, setSiteTitle] = useState(initial.settings.siteTitle);
  const [metaDescription, setMetaDescription] = useState(initial.settings.metaDescription);
  const [indexable, setIndexable] = useState(initial.settings.indexable);
  const [design, setDesign] = useState(initial.design);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/sites/${siteId}`, {
        name,
        description,
        language,
        timezone,
        brandVoice,
        keywords: keywords
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 30),
        siteTitle,
        metaDescription,
        indexable,
        ...(design ? { design } : {}),
      });
      toast.success(t("siteSettings.saved"));
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  const patchDesign = (partial: Partial<NonNullable<Initial["design"]>>) =>
    setDesign((current) => ({ ...(current ?? initial.design!), ...partial }));

  const remove = async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/sites/${siteId}`, { confirm: true });
      toast.success(t("siteSettings.deleted"));
      router.push("/sites");
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      {error ? (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      ) : null}

      <Card>
        <CardHeader title={t("siteSettings.general")} />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("siteSettings.siteName")}>
            {({ id }) => <Input id={id} value={name} onChange={(event) => setName(event.target.value)} />}
          </Field>
          <Field label={t("siteSettings.slug")}>
            {({ id }) => <Input id={id} value={siteId} readOnly />}
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("siteSettings.description")}>
              {({ id }) => (
                <Textarea
                  id={id}
                  rows={3}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              )}
            </Field>
          </div>
          <Field label={t("siteSettings.siteLanguage")} help={t("site.siteLanguageHelp")}>
            {({ id }) => (
              <Select id={id} value={language} onChange={(event) => setLanguage(event.target.value)}>
                {CONTENT_LANGUAGES.map((code) => (
                  <option key={code} value={code}>
                    {code.toUpperCase()}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t("siteSettings.timezone")}>
            {({ id }) => (
              <Input id={id} value={timezone} onChange={(event) => setTimezone(event.target.value)} />
            )}
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("siteSettings.brand")} />
        <CardBody className="space-y-4">
          <Field label={t("siteSettings.brandVoice")} help={t("siteSettings.brandVoiceHelp")}>
            {({ id }) => (
              <Textarea id={id} rows={4} value={brandVoice} onChange={(event) => setBrandVoice(event.target.value)} />
            )}
          </Field>
          <Field label={t("siteSettings.keywords")} help={t("editor.tagsHelp")}>
            {({ id }) => <Input id={id} value={keywords} onChange={(event) => setKeywords(event.target.value)} />}
          </Field>
        </CardBody>
      </Card>

      {design ? (
        <Card>
          <CardHeader title={t("siteSettings.design")} />
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ColorField
              label={t("siteSettings.primaryColor")}
              value={design.primaryColor}
              onChange={(primaryColor) => patchDesign({ primaryColor })}
            />
            <ColorField
              label={t("siteSettings.secondaryColor")}
              value={design.secondaryColor}
              onChange={(secondaryColor) => patchDesign({ secondaryColor })}
            />
            <ColorField
              label={t("siteSettings.surfaceColor")}
              value={design.surfaceColor}
              onChange={(surfaceColor) => patchDesign({ surfaceColor })}
            />
            <ColorField
              label={t("siteSettings.backgroundColor")}
              value={design.backgroundColor}
              onChange={(backgroundColor) => patchDesign({ backgroundColor })}
            />
            <ColorField
              label={t("siteSettings.textColor")}
              value={design.textColor}
              onChange={(textColor) => patchDesign({ textColor })}
            />
            <ColorField
              label={t("siteSettings.mutedColor")}
              value={design.mutedColor}
              onChange={(mutedColor) => patchDesign({ mutedColor })}
            />
            <Field label={t("siteSettings.fontStyle")}>
              {({ id }) => (
                <Select
                  id={id}
                  value={design.fontStyle}
                  onChange={(event) => patchDesign({ fontStyle: event.target.value })}
                >
                  {["modern", "classic", "editorial"].map((option) => (
                    <option key={option} value={option}>
                      {t(`siteSettings.fonts.${option}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t("siteSettings.layoutStyle")}>
              {({ id }) => (
                <Select
                  id={id}
                  value={design.layoutStyle}
                  onChange={(event) => patchDesign({ layoutStyle: event.target.value })}
                >
                  {["centered", "wide", "magazine"].map((option) => (
                    <option key={option} value={option}>
                      {t(`siteSettings.layouts.${option}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t("siteSettings.cardStyle")}>
              {({ id }) => (
                <Select
                  id={id}
                  value={design.cardStyle}
                  onChange={(event) => patchDesign({ cardStyle: event.target.value })}
                >
                  {["soft", "flat", "outlined"].map((option) => (
                    <option key={option} value={option}>
                      {t(`siteSettings.cards.${option}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t("siteSettings.borderRadius")}>
              {({ id }) => (
                <Input
                  id={id}
                  type="number"
                  min={0}
                  max={32}
                  value={design.borderRadius}
                  onChange={(event) => patchDesign({ borderRadius: Number(event.target.value) || 0 })}
                />
              )}
            </Field>
            <Field label={t("siteSettings.headerStyle")}>
              {({ id }) => (
                <Select
                  id={id}
                  value={design.headerStyle}
                  onChange={(event) => patchDesign({ headerStyle: event.target.value })}
                >
                  {["plain", "brand", "gradient"].map((option) => (
                    <option key={option} value={option}>
                      {t(`siteSettings.headers.${option}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t("siteSettings.heroStyle")}>
              {({ id }) => (
                <Select
                  id={id}
                  value={design.heroStyle}
                  onChange={(event) => patchDesign({ heroStyle: event.target.value })}
                >
                  {["simple", "banded", "centered"].map((option) => (
                    <option key={option} value={option}>
                      {t(`siteSettings.heroes.${option}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t("siteSettings.cardDensity")}>
              {({ id }) => (
                <Select
                  id={id}
                  value={design.cardDensity}
                  onChange={(event) => patchDesign({ cardDensity: event.target.value })}
                >
                  {["compact", "comfortable"].map((option) => (
                    <option key={option} value={option}>
                      {t(`siteSettings.densities.${option}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title={t("siteSettings.seoDefaults")} />
        <CardBody className="space-y-4">
          <Field label={t("blueprint.siteName")}>
            {({ id }) => <Input id={id} value={siteTitle} onChange={(event) => setSiteTitle(event.target.value)} />}
          </Field>
          <Field label={t("siteSettings.metaDescription")}>
            {({ id }) => (
              <Textarea
                id={id}
                rows={2}
                maxLength={180}
                value={metaDescription}
                onChange={(event) => setMetaDescription(event.target.value)}
              />
            )}
          </Field>
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={indexable}
              onChange={(event) => setIndexable(event.target.checked)}
              className="h-4 w-4 rounded border-line-strong accent-[var(--sp-accent)]"
            />
            {t("siteSettings.indexable")}
          </label>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button variant="primary" loading={busy} onClick={save} icon={<Check className="h-4 w-4" />}>
          {busy ? t("common.saving") : t("common.save")}
        </Button>
      </div>

      <Card>
        <CardHeader title={t("siteSettings.dangerZone")} />
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">{t("siteSettings.deleteWarning")}</p>
          <Button
            variant="danger"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => {
              setConfirmText("");
              setConfirmOpen(true);
            }}
          >
            {t("siteSettings.deleteSite")}
          </Button>
        </CardBody>
      </Card>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t("siteSettings.deleteDialogTitle", { name: initial.site.name })}
        description={t("siteSettings.deleteWarning")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              disabled={confirmText !== initial.site.name}
              onClick={remove}
            >
              {t("common.delete")}
            </Button>
          </>
        }
      >
        <Field label={t("siteSettings.deleteDialogHint")}>
          {({ id }) => (
            <Input
              id={id}
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder={initial.site.name}
              autoComplete="off"
            />
          )}
        </Field>
      </Dialog>
    </div>
  );
}
