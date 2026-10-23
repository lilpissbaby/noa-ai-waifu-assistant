# Políticas de contenido de Azure OpenAI para Waifu Desk.
#
# La app envía en cada mensaje la cabecera `x-policy-id` con una de estas políticas según los
# filtros del personaje activo (Ajustes → Modelos de IA → perfil de Azure → Políticas de contenido).
# Las tres primeras no necesitan aprobación de Microsoft. La cuarta (sin filtros en las respuestas)
# solo funciona si Microsoft ha aprobado tu solicitud de «Modified Content Filters».

terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 4.0"
    }
  }
}

provider "azurerm" {
  features {}
}

variable "cognitive_account_id" {
  description = "ID del recurso de Azure OpenAI (azurerm_cognitive_account.<nombre>.id o /subscriptions/…/accounts/<nombre>)"
  type        = string
}

locals {
  categories = ["Hate", "Sexual", "Violence", "SelfHarm"]
  sources    = ["Prompt", "Completion"]
  policies = {
    "waifudesk-strict"   = "Low"    # bloquea gravedad baja, media y alta
    "waifudesk-standard" = "Medium" # como el filtro por defecto de Microsoft
    "waifudesk-relaxed"  = "High"   # solo bloquea gravedad alta (no necesita aprobación)
  }
}

resource "azurerm_cognitive_account_rai_policy" "waifudesk" {
  for_each             = local.policies
  name                 = each.key
  cognitive_account_id = var.cognitive_account_id
  base_policy_name     = "Microsoft.DefaultV2"

  dynamic "content_filter" {
    for_each = setproduct(local.categories, local.sources)
    content {
      name               = content_filter.value[0]
      source             = content_filter.value[1]
      filter_enabled     = true
      block_enabled      = true
      severity_threshold = each.value
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Sin filtros en las respuestas: requiere aprobación de Microsoft (formulario «Limited Access
# Review: Modified Content Filters»). Si te la aprueban, descomenta y pon el nombre en la app.
#
# resource "azurerm_cognitive_account_rai_policy" "waifudesk_unfiltered" {
#   name                 = "waifudesk-unfiltered"
#   cognitive_account_id = var.cognitive_account_id
#   base_policy_name     = "Microsoft.DefaultV2"
#   dynamic "content_filter" {
#     for_each = setproduct(local.categories, local.sources)
#     content {
#       name               = content_filter.value[0]
#       source             = content_filter.value[1]
#       filter_enabled     = content_filter.value[1] == "Prompt"
#       block_enabled      = content_filter.value[1] == "Prompt"
#       severity_threshold = "High"
#     }
#   }
# }

output "policies" {
  value = [for p in azurerm_cognitive_account_rai_policy.waifudesk : p.name]
}
