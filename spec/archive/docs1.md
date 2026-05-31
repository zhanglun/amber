我建议先画两个图：

1. **系统架构图（Repository / Service Architecture）**
2. **知识流转与数据库流转图（Data Flow）**

这是当前阶段最重要的两个图。

---

# 1. PKP 整体架构图

```mermaid
flowchart TB

    DINO[DINO Capture Engine]

    subgraph PKP["PKP Monorepo"]

        subgraph Apps

            API[apps/api<br/>NestJS]

            Desktop[apps/desktop<br/>Tauri]

        end

        subgraph Packages

            Models[models]

            Importer[importer]

            Storage[storage]

            Search[search]

            Sync[sync]

            AI[ai]

        end

    end

    PostgreSQL[(PostgreSQL)]

    PGVector[(pgvector)]

    R2[(Cloudflare R2)]

    LLM[LLM Provider]

    DINO --> Importer

    Importer --> Models

    Importer --> Storage

    Storage --> PostgreSQL

    Storage --> R2

    Search --> PostgreSQL

    Search --> PGVector

    AI --> LLM

    AI --> Search

    API --> Importer
    API --> Search
    API --> Sync
    API --> AI

    Desktop --> API
```

---

# 2. Knowledge Pipeline

这是产品核心。

```mermaid
flowchart LR

    URL[URL]
    PDF[PDF]
    MD[Markdown]

    URL --> DINO
    PDF --> Importer
    MD --> Importer

    DINO --> Normalize

    Importer --> Normalize

    Normalize --> KnowledgeItem

    KnowledgeItem --> Summary

    Summary --> Embedding

    Embedding --> Store

    Store --> Search

    Search --> Recall

    Recall --> Synthesis

    Synthesis --> User
```

---

# 3. DINO -> PKP 导入流程

这是你下一步真正要开发的。

```mermaid
sequenceDiagram

    participant User

    participant Dino

    participant Importer

    participant Storage

    participant DB

    participant R2

    User->>Dino: dino https://xxx.com

    Dino-->>User: article.md

    Dino-->>User: assets/*

    User->>Importer: pkp import capture/

    Importer->>Importer: Parse Metadata

    Importer->>Importer: Parse Markdown

    Importer->>R2: Upload Assets

    Importer->>DB: Create KnowledgeItem

    DB-->>Importer: item_id

    Importer-->>User: Import Success
```

---

# 4. 数据库流转图（当前最关键）

这个是我认为未来 1~2 年都不会大改的。

```mermaid
flowchart TD

    Capture[Captured Content]

    Capture --> KnowledgeItem

    KnowledgeItem --> knowledge_items

    KnowledgeItem --> knowledge_assets

    KnowledgeItem --> knowledge_tags

    KnowledgeItem --> knowledge_embeddings

    knowledge_assets --> R2

    knowledge_embeddings --> pgvector

    knowledge_items --> Search

    knowledge_tags --> Search

    knowledge_embeddings --> SemanticSearch

    Search --> Recall

    SemanticSearch --> Recall

    Recall --> AIWorkspace
```

---

# 5. 数据模型 ER 图（V1）

```mermaid
erDiagram

    KNOWLEDGE_ITEMS {

        uuid id

        string title

        text content

        text summary

        string source_url

        string source_type

        timestamp captured_at

        timestamp created_at

    }

    KNOWLEDGE_ASSETS {

        uuid id

        uuid item_id

        string asset_type

        string storage_key

        string original_url

    }

    KNOWLEDGE_TAGS {

        uuid id

        string name

    }

    ITEM_TAGS {

        uuid item_id

        uuid tag_id

    }

    KNOWLEDGE_EMBEDDINGS {

        uuid item_id

        vector embedding

    }

    KNOWLEDGE_ITEMS ||--o{ KNOWLEDGE_ASSETS : contains

    KNOWLEDGE_ITEMS ||--o{ ITEM_TAGS : tagged

    KNOWLEDGE_TAGS ||--o{ ITEM_TAGS : belongs

    KNOWLEDGE_ITEMS ||--|| KNOWLEDGE_EMBEDDINGS : embedded
```

---

# 6. 我认为当前真正的开发顺序

```mermaid
flowchart LR

    A[Define KnowledgeItem]

    B[Define DINO Output Spec]

    C[Build Importer]

    D[Storage Layer]

    E[Search]

    F[Tauri Reader]

    G[Sync]

    H[AI Layer]

    A --> B

    B --> C

    C --> D

    D --> E

    E --> F

    F --> G

    G --> H
```

这个顺序最大的好处是：

```text
DINO
 ↓
KnowledgeItem
 ↓
Storage
 ↓
Search
```

先形成闭环。

而不是一开始就陷入：

```text
Tiptap
协同编辑
知识图谱
Agent
```

这些暂时还不会产生实际价值的功能。
