package graphql

import (
	"strings"

	"github.com/sandboxws/flink-reactor-console/server/internal/graphql/model"
	"github.com/sandboxws/flink-reactor-console/server/internal/templates"
)

// templateToModel projects a registry Manifest onto the GraphQL Template model.
func templateToModel(m templates.Manifest) *model.Template {
	pipelines := make([]*model.TemplatePipeline, 0, len(m.Pipelines))
	for _, p := range m.Pipelines {
		pipelines = append(pipelines, &model.TemplatePipeline{Name: p})
	}

	params := make([]*model.TemplateParam, 0, len(m.Params))
	for _, p := range m.Params {
		params = append(params, &model.TemplateParam{
			Name:        p.Name,
			Type:        p.Type,
			Required:    p.Required,
			Default:     p.Default,
			Options:     p.Options,
			Description: p.Description,
		})
	}

	return &model.Template{
		Name:             m.Name,
		Category:         templateCategory(m.Category),
		Description:      m.Description,
		Pipelines:        pipelines,
		RequiredServices: m.RequiredServices,
		Params:           params,
	}
}

// templateCategory maps the DSL's lower-case category ("lakehouse") onto the
// GraphQL enum ("LAKEHOUSE"), falling back to SHOWCASE for anything unknown.
func templateCategory(c string) model.TemplateCategory {
	cat := model.TemplateCategory(strings.ToUpper(c))
	if cat.IsValid() {
		return cat
	}
	return model.TemplateCategoryShowcase
}
