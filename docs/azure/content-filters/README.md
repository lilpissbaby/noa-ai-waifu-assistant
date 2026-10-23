# Políticas de contenido de Azure OpenAI

Azure OpenAI aplica su propio filtro de contenido además de lo que pida la app. Con este Terraform creas
tres políticas en tu recurso, y Waifu Desk elige una en cada mensaje (cabecera `x-policy-id`) según los
filtros del personaje activo:

| Política | Bloquea | Cuándo la usa la app (modo «según los filtros del personaje») |
|---|---|---|
| `waifudesk-strict` | gravedad baja, media y alta | lenguaje, violencia y sexo en «evitar/no» |
| `waifudesk-standard` | media y alta (como el de Microsoft) | lo normal |
| `waifudesk-relaxed` | solo alta | contenido sexual insinuante o explícito, o violencia «libre» |
| `waifudesk-unfiltered` (comentada) | nada en las respuestas | contenido explícito, si Microsoft te lo aprueba |

## Pasos

```bash
cd docs/azure/content-filters
terraform init
terraform apply -var 'cognitive_account_id=/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<recurso>'
```

En la app: Ajustes → Modelos de IA → Añadir perfil → **Azure OpenAI**.

- URL base: `https://<recurso>.openai.azure.com/openai/v1`
- Modelo: el **nombre del despliegue**
- Clave: la del recurso (va en la cabecera `api-key`)
- Políticas de contenido: los nombres de arriba (ya vienen puestos)

## Lo que no puede hacer la app

- **Quitar el filtro de las respuestas** solo es posible si Microsoft aprueba tu solicitud de *Modified
  Content Filters*. Sin esa aprobación, la política más permisiva bloquea la gravedad alta.
- Los modelos de OpenAI desplegados en Azure siguen sus propias normas aunque el filtro de Azure lo permita.
- Cuando Azure bloquea algo, la app muestra qué categoría lo ha bloqueado.
