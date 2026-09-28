"use client";

import { useCallback } from "react";
import { Plus, Trash2, Palette } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import type { Blueprint } from "@/lib/ai/schemas";
import { Field, Input, Select, Textarea, ColorField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

type Props = {
  value: Blueprint;
  onChange: (next: Blueprint) => void;
  disabled?: boolean;
};

function TagInput({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const t = useT();
  return (
    <Input
      defaultValue={value.join(", ")}
      disabled={disabled}
      placeholder="a, b, c"
      aria-label={t("common.edit")}
      onChange={(event) => {
        const items = event.target.value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        onChange(items);
      }}
      onBlur={(event) => {
        const items = event.target.value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        onChange(items);
      }}
    />
  );
}

/** Editable blueprint: the AI output is data the user can change before approval. */
export function BlueprintEditor({ value, onChange, disabled = false }: Props) {
  const t = useT();

  const patch = useCallback(
    (partial: Partial<Blueprint>) => onChange({ ...value, ...partial }),
    [onChange, value],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={t("blueprint.editTitle")}
          description={t("onboarding.blueprintHelp")}
          level={3}
        />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={t("blueprint.siteName")}>
              {({ id }) => (
                <Input
                  id={id}
                  value={value.siteName}
                  disabled={disabled}
                  onChange={(event) => patch({ siteName: event.target.value })}
                />
              )}
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label={t("blueprint.description")}>
              {({ id }) => (
                <Textarea
                  id={id}
                  rows={3}
                  value={value.description}
                  disabled={disabled}
                  onChange={(event) => patch({ description: event.target.value })}
                />
              )}
            </Field>
          </div>

          <Field label={t("blueprint.targetAudience")}>
            {({ id }) => (
              <Input
                id={id}
                value={value.targetAudience}
                disabled={disabled}
                onChange={(event) => patch({ targetAudience: event.target.value })}
              />
            )}
          </Field>

          <Field label={t("blueprint.primaryGoal")}>
            {({ id }) => (
              <Input
                id={id}
                value={value.primaryGoal}
                disabled={disabled}
                onChange={(event) => patch({ primaryGoal: event.target.value })}
              />
            )}
          </Field>

          <Field label={t("blueprint.tone")}>
            {({ id }) => (
              <Input
                id={id}
                value={value.tone}
                disabled={disabled}
                onChange={(event) => patch({ tone: event.target.value })}
              />
            )}
          </Field>

          <Field label={t("blueprint.publishingFrequency")}>
            {({ id }) => (
              <Select
                id={id}
                value={value.publishingFrequency}
                disabled={disabled}
                onChange={(event) =>
                  patch({ publishingFrequency: event.target.value as Blueprint["publishingFrequency"] })
                }
              >
                {["ONCE_A_WEEK", "TWICE_A_WEEK", "THREE_A_WEEK", "FIVE_A_WEEK", "DAILY"].map(
                  (option) => (
                    <option key={option} value={option}>
                      {t(`schedule.frequencies.${option}`)}
                    </option>
                  ),
                )}
              </Select>
            )}
          </Field>

          <div className="sm:col-span-2">
            <Field label={t("blueprint.contentTypes")} help={t("editor.tagsHelp")}>
              {() => (
                <TagInput
                  value={value.contentTypes}
                  disabled={disabled}
                  onChange={(contentTypes) => patch({ contentTypes })}
                />
              )}
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader
          title={`${t("blueprint.categories")} (${value.categories.length})`}
          actions={
            <Button
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              disabled={disabled}
              onClick={() =>
                patch({ categories: [...value.categories, { name: "", description: "" }] })
              }
            >
              {t("common.add")}
            </Button>
          }
          level={3}
        />
        <CardBody className="space-y-3">
          {value.categories.map((category, index) => (
            <div key={index} className="surface-2 flex flex-col gap-3 p-3 sm:flex-row">
              <div className="min-w-0 flex-1 space-y-2">
                <Input
                  value={category.name}
                  disabled={disabled}
                  aria-label={`${t("blueprint.categories")} ${index + 1}`}
                  onChange={(event) => {
                    const categories = [...value.categories];
                    categories[index] = { ...category, name: event.target.value };
                    patch({ categories });
                  }}
                />
                <Input
                  value={category.description}
                  disabled={disabled}
                  aria-label={t("common.description")}
                  onChange={(event) => {
                    const categories = [...value.categories];
                    categories[index] = { ...category, description: event.target.value };
                    patch({ categories });
                  }}
                />
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={disabled || value.categories.length <= 1}
                icon={<Trash2 className="h-4 w-4" />}
                aria-label={t("common.remove")}
                className="sm:self-start"
                onClick={() =>
                  patch({ categories: value.categories.filter((_, i) => i !== index) })
                }
              />
            </div>
          ))}
        </CardBody>
      </Card>

      {/* Pages */}
      <Card>
        <CardHeader
          title={`${t("blueprint.pages")} (${value.pages.length})`}
          actions={
            <Button
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              disabled={disabled}
              onClick={() => patch({ pages: [...value.pages, { title: "", slug: "", purpose: "" }] })}
            >
              {t("common.add")}
            </Button>
          }
          level={3}
        />
        <CardBody className="space-y-3">
          {value.pages.map((page, index) => (
            <div key={index} className="surface-2 p-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  className="sm:w-1/3"
                  value={page.title}
                  disabled={disabled}
                  aria-label={`${t("blueprint.pages")} ${index + 1}`}
                  onChange={(event) => {
                    const pages = [...value.pages];
                    pages[index] = { ...page, title: event.target.value };
                    patch({ pages });
                  }}
                />
                <Input
                  className="sm:w-1/4"
                  value={page.slug}
                  disabled={disabled}
                  aria-label="slug"
                  onChange={(event) => {
                    const pages = [...value.pages];
                    pages[index] = { ...page, slug: event.target.value };
                    patch({ pages });
                  }}
                />
                <Input
                  className="flex-1"
                  value={page.purpose}
                  disabled={disabled}
                  aria-label={t("common.description")}
                  onChange={(event) => {
                    const pages = [...value.pages];
                    pages[index] = { ...page, purpose: event.target.value };
                    patch({ pages });
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled || value.pages.length <= 1}
                  icon={<Trash2 className="h-4 w-4" />}
                  aria-label={t("common.remove")}
                  className="sm:w-auto"
                  onClick={() => patch({ pages: value.pages.filter((_, i) => i !== index) })}
                />
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      {/* SEO strategy */}
      <Card>
        <CardHeader title={t("blueprint.seoStrategy")} level={3} />
        <CardBody className="space-y-4">
          <Field label={t("blueprint.seoApproach")}>
            {({ id }) => (
              <Textarea
                id={id}
                rows={2}
                value={value.seoStrategy.approach}
                disabled={disabled}
                onChange={(event) =>
                  patch({ seoStrategy: { ...value.seoStrategy, approach: event.target.value } })
                }
              />
            )}
          </Field>
          <Field label={t("blueprint.seoKeywords")} help={t("editor.tagsHelp")}>
            {() => (
              <TagInput
                value={value.seoStrategy.keywords}
                disabled={disabled}
                onChange={(keywords) => patch({ seoStrategy: { ...value.seoStrategy, keywords } })}
              />
            )}
          </Field>
          <Field label={t("blueprint.monetization")} help={t("editor.tagsHelp")}>
            {() => (
              <TagInput
                value={value.monetization}
                disabled={disabled}
                onChange={(monetization) => patch({ monetization })}
              />
            )}
          </Field>
        </CardBody>
      </Card>

      {/* Design */}
      {value.design ? (
        <Card>
          <CardHeader
            title={t("blueprint.design")}
            actions={<Palette className="h-4 w-4 text-faint" aria-hidden="true" />}
            level={3}
          />
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ColorField
              label={t("siteSettings.primaryColor")}
              value={value.design.primaryColor}
              onChange={(primaryColor) =>
                patch({ design: { ...value.design!, primaryColor } })
              }
            />
            <ColorField
              label={t("siteSettings.secondaryColor")}
              value={value.design.secondaryColor}
              onChange={(secondaryColor) =>
                patch({ design: { ...value.design!, secondaryColor } })
              }
            />
            <ColorField
              label={t("siteSettings.backgroundColor")}
              value={value.design.backgroundColor}
              onChange={(backgroundColor) =>
                patch({ design: { ...value.design!, backgroundColor } })
              }
            />
            <ColorField
              label={t("siteSettings.textColor")}
              value={value.design.textColor}
              onChange={(textColor) => patch({ design: { ...value.design!, textColor } })}
            />
            <Field label={t("siteSettings.fontStyle")}>
              {({ id }) => (
                <Select
                  id={id}
                  value={value.design!.fontStyle}
                  disabled={disabled}
                  onChange={(event) =>
                    patch({
                      design: {
                        ...value.design!,
                        fontStyle: event.target.value as "modern" | "classic" | "editorial",
                      },
                    })
                  }
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
                  value={value.design!.layoutStyle}
                  disabled={disabled}
                  onChange={(event) =>
                    patch({
                      design: {
                        ...value.design!,
                        layoutStyle: event.target.value as "centered" | "wide" | "magazine",
                      },
                    })
                  }
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
                  value={value.design!.cardStyle}
                  disabled={disabled}
                  onChange={(event) =>
                    patch({
                      design: {
                        ...value.design!,
                        cardStyle: event.target.value as "soft" | "flat" | "outlined",
                      },
                    })
                  }
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
                  value={value.design!.borderRadius}
                  disabled={disabled}
                  onChange={(event) =>
                    patch({
                      design: { ...value.design!, borderRadius: Number(event.target.value) || 0 },
                    })
                  }
                />
              )}
            </Field>
            <ColorField
              label={t("siteSettings.surfaceColor")}
              value={value.design.surfaceColor}
              onChange={(surfaceColor) => patch({ design: { ...value.design!, surfaceColor } })}
            />
            <ColorField
              label={t("siteSettings.mutedColor")}
              value={value.design.mutedColor}
              onChange={(mutedColor) => patch({ design: { ...value.design!, mutedColor } })}
            />
            <Field label={t("siteSettings.headerStyle")}>
              {({ id }) => (
                <Select
                  id={id}
                  value={value.design!.headerStyle}
                  disabled={disabled}
                  onChange={(event) =>
                    patch({
                      design: {
                        ...value.design!,
                        headerStyle: event.target.value as "plain" | "brand" | "gradient",
                      },
                    })
                  }
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
                  value={value.design!.heroStyle}
                  disabled={disabled}
                  onChange={(event) =>
                    patch({
                      design: {
                        ...value.design!,
                        heroStyle: event.target.value as "simple" | "banded" | "centered",
                      },
                    })
                  }
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
                  value={value.design!.cardDensity}
                  disabled={disabled}
                  onChange={(event) =>
                    patch({
                      design: {
                        ...value.design!,
                        cardDensity: event.target.value as "compact" | "comfortable",
                      },
                    })
                  }
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
    </div>
  );
}
