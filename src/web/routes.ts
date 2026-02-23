import { FastifyInstance } from "fastify";
import { serverRepo } from "../db/server-repo.js";
import { categoryRepo } from "../db/category-repo.js";

export async function webRoutes(app: FastifyInstance) {
  // Homepage
  app.get("/", async (request, reply) => {
    const [stats, categoriesWithCounts, featured] = await Promise.all([
      serverRepo.getStats(),
      categoryRepo.listWithCounts(),
      serverRepo.list({ sortBy: "quality", limit: 12 }),
    ]);

    return reply.view("home.ejs", {
      title: "MCP Index — Discover MCP Servers",
      stats,
      categories: categoriesWithCounts,
      featured: featured.items,
    });
  });

  // Server directory
  app.get("/servers", async (request, reply) => {
    const query = request.query as {
      search?: string;
      sort?: string;
      category?: string;
      page?: string;
    };

    const page = Math.max(1, parseInt(query.page || "1", 10) || 1);
    const limit = 24;
    const offset = (page - 1) * limit;
    const sortBy = (query.sort as "quality" | "stars" | "downloads" | "recent" | "name") || "quality";

    // Resolve category slug to ID
    let categoryId: string | undefined;
    let activeCategory: { name: string; slug: string } | undefined;
    if (query.category) {
      const cat = await categoryRepo.findBySlug(query.category);
      if (cat) {
        categoryId = cat.id;
        activeCategory = { name: cat.name, slug: cat.slug };
      }
    }

    const [result, allCategories] = await Promise.all([
      serverRepo.list({ search: query.search, sortBy, categoryId, limit, offset }),
      categoryRepo.findAll(),
    ]);

    const totalPages = Math.ceil(result.total / limit);

    return reply.view("servers.ejs", {
      title: query.search ? `Search: ${query.search} — MCP Index` : "Browse MCP Servers — MCP Index",
      servers: result.items,
      total: result.total,
      page,
      totalPages,
      search: query.search || "",
      sort: sortBy,
      categories: allCategories,
      activeCategory,
    });
  });

  // Server detail
  app.get("/servers/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const server = await serverRepo.findBySlug(slug);

    if (!server) {
      reply.code(404);
      return reply.view("home.ejs", {
        title: "Server Not Found — MCP Index",
        error: "Server not found",
        stats: await serverRepo.getStats(),
        categories: await categoryRepo.listWithCounts(),
        featured: [],
      });
    }

    return reply.view("server-detail.ejs", {
      title: `${server.name} — MCP Index`,
      server,
    });
  });

  // Category page
  app.get("/category/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const query = request.query as { sort?: string; page?: string };

    const category = await categoryRepo.findBySlug(slug);
    if (!category) {
      return reply.redirect("/servers");
    }

    const page = Math.max(1, parseInt(query.page || "1", 10) || 1);
    const limit = 24;
    const offset = (page - 1) * limit;
    const sortBy = (query.sort as "quality" | "stars" | "downloads" | "recent" | "name") || "quality";

    const result = await serverRepo.list({ categoryId: category.id, sortBy, limit, offset });
    const totalPages = Math.ceil(result.total / limit);

    return reply.view("category.ejs", {
      title: `${category.name} MCP Servers — MCP Index`,
      category,
      servers: result.items,
      total: result.total,
      page,
      totalPages,
      sort: sortBy,
    });
  });
}
