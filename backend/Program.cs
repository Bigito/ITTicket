using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddDbContext<TicketDbContext>(options =>
    options.UseSqlServer("Data Source=203.151.136.161;Initial Catalog=ITTicketSystem;User ID=sarpc161;Password=bysNVuF#01;TrustServerCertificate=True;"));

// Add RPC Database Context for branch data
builder.Services.AddDbContext<RpcDbContext>(options =>
    options.UseSqlServer("Data Source=203.151.66.69;Initial Catalog=RpcMaster;User ID=sarpc;Password=Ub@nSA53dzTx2>Ps;TrustServerCertificate=True;"));

// Add RPC Website Database Context for user data
builder.Services.AddDbContext<RpcWebsiteDbContext>(options =>
    options.UseSqlServer("Data Source=203.151.66.69;Initial Catalog=RpcWebsite;User ID=sarpc;Password=Ub@nSA53dzTx2>Ps;TrustServerCertificate=True;"));

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://127.0.0.1:3000")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
    
    // More permissive policy for development
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline
app.UseCors("AllowAll"); // Using more permissive policy for development

// Add CORS headers to ALL responses
app.Use(async (context, next) =>
{
    // Add CORS headers to every response
    context.Response.Headers["Access-Control-Allow-Origin"] = "http://localhost:3000";
    context.Response.Headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
    context.Response.Headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With";
    context.Response.Headers["Access-Control-Allow-Credentials"] = "true";
    
    // Handle preflight requests
    if (context.Request.Method == "OPTIONS")
    {
        context.Response.StatusCode = 200;
        await context.Response.WriteAsync(string.Empty);
        return;
    }
    
    await next();
});

// Ensure database connection and tables exist
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<TicketDbContext>();
    
    try
    {
            Console.WriteLine("🔄 Testing database connection...");
            var canConnect = await context.Database.CanConnectAsync();
            Console.WriteLine($"🔍 Database connection: {(canConnect ? "SUCCESS" : "FAILED")}");
            
            if (!canConnect)
            {
                throw new Exception("Cannot connect to database. Please check SQL Server and connection string.");
            }
            
            Console.WriteLine("🔄 Ensuring database tables exist...");
            var created = context.Database.EnsureCreated();
            Console.WriteLine($"✅ Database tables {(created ? "created" : "already exist")} successfully!");
            
            // Force create Tickets table if it doesn't exist
            try
            {
                Console.WriteLine("🔄 Verifying Tickets table exists...");
                await context.Database.ExecuteSqlRawAsync(@"
                    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Tickets')
                    BEGIN
                        CREATE TABLE [dbo].[Tickets] (
                            [Id] int IDENTITY(1,1) NOT NULL,
                            [TicketNumber] nvarchar(50) NOT NULL,
                            [ReporterName] nvarchar(100) NOT NULL,
                            [ContactNumber] nvarchar(20) NOT NULL,
                            [Branch] nvarchar(100) NOT NULL,
                            [IssueType] nvarchar(100) NOT NULL,
                            [ReportedIssue] nvarchar(max) NOT NULL,
                            [DateOfTicket] datetime2 NOT NULL,
                            [TicketOpenTime] datetime2 NOT NULL,
                            [WorkStartTime] datetime2 NULL,
                            [WorkEndTime] datetime2 NULL,
                            [Status] nvarchar(50) NOT NULL,
                            [Priority] nvarchar(20) NOT NULL,
                            [AssignedTo] nvarchar(100) NOT NULL,
                            [CreatedBy] nvarchar(100) NOT NULL,
                            [CreatedDate] datetime2 NOT NULL,
                            CONSTRAINT [PK_Tickets] PRIMARY KEY ([Id])
                        );
                        PRINT 'Tickets table created successfully';
                    END
                    ELSE
                    BEGIN
                        PRINT 'Tickets table already exists';
                    END
                ");
                Console.WriteLine("✅ Tickets table verification completed!");
                
                // Also create other required tables
                await context.Database.ExecuteSqlRawAsync(@"
                    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
                    BEGIN
                        CREATE TABLE [dbo].[Users] (
                            [Id] int IDENTITY(1,1) NOT NULL,
                            [Username] nvarchar(50) NOT NULL,
                            [FullName] nvarchar(100) NOT NULL,
                            [Email] nvarchar(100) NOT NULL,
                            [Phone] nvarchar(20) NULL,
                            [Role] nvarchar(20) NOT NULL DEFAULT 'user',
                            [Password] nvarchar(100) NOT NULL,
                            CONSTRAINT [PK_Users] PRIMARY KEY ([Id])
                        );
                        PRINT 'Users table created successfully';
                    END
                    
                    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'IssueTypes')
                    BEGIN
                        CREATE TABLE [dbo].[IssueTypes] (
                            [Id] int IDENTITY(1,1) NOT NULL,
                            [Name] nvarchar(100) NOT NULL,
                            [Description] nvarchar(500) NOT NULL,
                            [IsActive] bit NOT NULL DEFAULT 1,
                            CONSTRAINT [PK_IssueTypes] PRIMARY KEY ([Id])
                        );
                        PRINT 'IssueTypes table created successfully';
                    END
                ");
                Console.WriteLine("✅ All required tables verified/created!");
            }
            catch (Exception tableEx)
            {
                Console.WriteLine($"⚠️  Could not create/verify tables: {tableEx.Message}");
            }
        
        
        
        // Force creation of all tables by accessing them
        try
        {
            var issueTypeCount = context.IssueTypes.Count();
            var priorityCount = context.Priorities.Count();
            Console.WriteLine($"📊 Issue Types: {issueTypeCount}, Priorities: {priorityCount} (from your database)");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"⚠️  Table access issue: {ex.Message}");
        }
        
        try
        {
            // Verify Tickets table exists by checking if we can query it
            var ticketCount = context.Tickets.Count();
            Console.WriteLine($"📊 Tickets: {ticketCount} (from your database)");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"⚠️  Tickets table issue: {ex.Message}");
            
            // If Tickets table doesn't exist, try to force create it
            if (ex.Message.Contains("Invalid object name 'Tickets'"))
            {
                Console.WriteLine("🔄 Tickets table missing, attempting to force create...");
                try
                {
                    // Force create the database and tables again
                    var forceCreated = context.Database.EnsureCreated();
                    Console.WriteLine($"✅ Force creation result: {(forceCreated ? "created" : "already exists")}");
                    
                    // Try to query again
                    var ticketCount = context.Tickets.Count();
                    Console.WriteLine($"📊 Tickets after force create: {ticketCount}");
                }
                catch (Exception forceEx)
                {
                    Console.WriteLine($"❌ Force creation failed: {forceEx.Message}");
                }
            }
        }
        
        try
        {
            var branchCount = context.Branches.Count();
            Console.WriteLine($"📊 Branches: {branchCount} (from your database)");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"⚠️  Branches table issue: {ex.Message}");
        }
        
        try
        {
            var priorityCount = context.Priorities.Count();
            Console.WriteLine($"📊 Priorities: {priorityCount} (from your database)");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"⚠️  Priorities table issue: {ex.Message}");
        }
        
        try
        {
            var statusCount = context.Statuses.Count();
            Console.WriteLine($"📊 Statuses: {statusCount} (from your database)");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"⚠️  Statuses table issue: {ex.Message}");
        }
        
        try
        {
            var userCount = context.Users.Count();
            Console.WriteLine($"📊 Users: {userCount} (from your database)");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"⚠️  Users table issue: {ex.Message}");
        }
        
        // Add seed data for master data tables if they're empty
        try
        {
            if (!context.Priorities.Any())
            {
                var priorities = new List<Priority>
                {
                    new Priority { Name = "Low", Description = "Low priority issues", Color = "#28a745" },
                    new Priority { Name = "Medium", Description = "Medium priority issues", Color = "#ffc107" },
                    new Priority { Name = "High", Description = "High priority issues", Color = "#fd7e14" },
                    new Priority { Name = "Critical", Description = "Critical priority issues", Color = "#dc3545" }
                };
                context.Priorities.AddRange(priorities);
                context.SaveChanges();
                Console.WriteLine("✅ Added default priorities");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"⚠️  Could not add priorities: {ex.Message}");
        }
        
        try
        {
            if (!context.Statuses.Any())
            {
                var statuses = new List<Status>
                {
                    new Status { Name = "Open", Description = "New ticket", Color = "#007bff" },
                    new Status { Name = "In Progress", Description = "Work in progress", Color = "#ffc107" },
                    new Status { Name = "Resolved", Description = "Issue resolved", Color = "#28a745" },
                    new Status { Name = "Closed", Description = "Ticket closed", Color = "#6c757d" }
                };
                context.Statuses.AddRange(statuses);
                context.SaveChanges();
                Console.WriteLine("✅ Added default statuses");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"⚠️  Could not add statuses: {ex.Message}");
        }
        
        try
        {
            if (!context.Users.Any())
            {
                var users = new List<User>
                {
                    new User { FullName = "Admin User", Email = "admin@company.com", Role = "Admin", IsActive = true },
                    new User { FullName = "John Smith", Email = "john@company.com", Role = "Technician", IsActive = true },
                    new User { FullName = "Sarah Johnson", Email = "sarah@company.com", Role = "Technician", IsActive = true }
                };
                context.Users.AddRange(users);
                context.SaveChanges();
                Console.WriteLine("✅ Added default users");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"⚠️  Could not add users: {ex.Message}");
        }
        
        Console.WriteLine("✅ Using real data from ITTicketSystem database only");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"❌ Database connection failed: {ex.Message}");
        Console.WriteLine("Please ensure SQL Server is running and the ITTicketSystem database exists.");
    }
}

// Manual table creation endpoint
app.MapPost("/api/create-tables", async (TicketDbContext dbContext) =>
{
    try
    {
        Console.WriteLine("🔄 Manual table creation requested...");
        
        // Create Tickets table
        await dbContext.Database.ExecuteSqlRawAsync(@"
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Tickets')
            BEGIN
                CREATE TABLE [dbo].[Tickets] (
                    [Id] int IDENTITY(1,1) NOT NULL,
                    [TicketNumber] nvarchar(50) NOT NULL,
                    [ReporterName] nvarchar(100) NOT NULL,
                    [ContactNumber] nvarchar(20) NOT NULL,
                    [Branch] nvarchar(100) NOT NULL,
                    [IssueType] nvarchar(100) NOT NULL,
                    [ReportedIssue] nvarchar(max) NOT NULL,
                    [DateOfTicket] datetime2 NOT NULL,
                    [TicketOpenTime] datetime2 NOT NULL,
                    [WorkStartTime] datetime2 NULL,
                    [WorkEndTime] datetime2 NULL,
                    [Status] nvarchar(50) NOT NULL,
                    [Priority] nvarchar(20) NOT NULL,
                    [AssignedTo] nvarchar(100) NOT NULL,
                    [CreatedBy] nvarchar(100) NOT NULL,
                    [CreatedDate] datetime2 NOT NULL,
                    CONSTRAINT [PK_Tickets] PRIMARY KEY ([Id])
                );
                PRINT 'Tickets table created successfully';
            END
            ELSE
            BEGIN
                PRINT 'Tickets table already exists';
            END
        ");
        
        // Create Users table
        await dbContext.Database.ExecuteSqlRawAsync(@"
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
            BEGIN
                CREATE TABLE [dbo].[Users] (
                    [Id] int IDENTITY(1,1) NOT NULL,
                    [Username] nvarchar(50) NOT NULL,
                    [FullName] nvarchar(100) NOT NULL,
                    [Email] nvarchar(100) NOT NULL,
                    [Phone] nvarchar(20) NULL,
                    [Role] nvarchar(20) NOT NULL DEFAULT 'user',
                    [Password] nvarchar(100) NOT NULL,
                    CONSTRAINT [PK_Users] PRIMARY KEY ([Id])
                );
                PRINT 'Users table created successfully';
            END
        ");
        
        // Create IssueTypes table
        await dbContext.Database.ExecuteSqlRawAsync(@"
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'IssueTypes')
            BEGIN
                CREATE TABLE [dbo].[IssueTypes] (
                    [Id] int IDENTITY(1,1) NOT NULL,
                    [Name] nvarchar(100) NOT NULL,
                    [Description] nvarchar(500) NOT NULL,
                    [IsActive] bit NOT NULL DEFAULT 1,
                    CONSTRAINT [PK_IssueTypes] PRIMARY KEY ([Id])
                );
                PRINT 'IssueTypes table created successfully';
            END
        ");
        
        Console.WriteLine("✅ All tables created successfully!");
        return Results.Ok(new { message = "Tables created successfully!" });
    }
    catch (Exception ex)
    {
        Console.WriteLine($"❌ Error creating tables: {ex.Message}");
        return Results.Problem($"Error creating tables: {ex.Message}");
    }
});

// API Endpoints
app.MapGet("/api/tickets", async (HttpContext context, TicketDbContext dbContext) =>
{
    try
    {
        // Get query parameters from the request
        var userRole = context.Request.Query["userRole"].FirstOrDefault();
        var userId = context.Request.Query["userId"].FirstOrDefault();
        
        Console.WriteLine($"🔍 API Request - userRole: '{userRole}', userId: '{userId}'");
        
        var query = dbContext.Tickets.AsQueryable();
        
        // If user is not admin, filter to show only their own tickets
        if (!string.IsNullOrEmpty(userRole) && userRole.ToLower() != "admin")
        {
            Console.WriteLine($"🔒 Filtering for non-admin user: {userId}");
            
            // Debug: Show all tickets first
            var allTickets = await dbContext.Tickets.ToListAsync();
            Console.WriteLine($"📊 Total tickets in database: {allTickets.Count}");
            foreach (var ticket in allTickets.Take(3))
            {
                Console.WriteLine($"  - {ticket.TicketNumber}: CreatedBy='{ticket.CreatedBy}', AssignedTo='{ticket.AssignedTo}'");
            }
            
            // For regular users, show only tickets they created or are assigned to
            query = query.Where(t => t.CreatedBy == userId || t.AssignedTo == userId);
            Console.WriteLine($"🔒 Applied filter: CreatedBy='{userId}' OR AssignedTo='{userId}'");
        }
        else
        {
            Console.WriteLine($"👑 Admin user - showing all tickets");
        }
        
        var tickets = await query.ToListAsync();
        Console.WriteLine($"📊 Returning {tickets.Count} tickets");
        
        return Results.Ok(tickets);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error fetching tickets: {ex.Message}");
        // If it's a column error, try to recreate the table
        if (ex.Message.Contains("Attachment"))
        {
            try
            {
                Console.WriteLine("Detected Attachment column error, recreating Tickets table...");
                await dbContext.Database.ExecuteSqlRawAsync(@"
                    IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Tickets')
                    BEGIN
                        DROP TABLE Tickets;
                    END
                ");
                dbContext.Database.EnsureCreated();
                Console.WriteLine("✅ Tickets table recreated successfully!");
                
                // Try again
                var tickets = await dbContext.Tickets.ToListAsync();
                return Results.Ok(tickets);
            }
            catch (Exception recreateEx)
            {
                Console.WriteLine($"Error recreating table: {recreateEx.Message}");
                return Results.Problem($"Database error: {recreateEx.Message}");
            }
        }
        return Results.Problem($"Error fetching tickets: {ex.Message}");
    }
});

app.MapGet("/api/tickets/{id}", async (int id, TicketDbContext context) =>
{
    var ticket = await context.Tickets.FindAsync(id);
    return ticket != null ? Results.Ok(ticket) : Results.NotFound();
});

app.MapGet("/api/tickets/by-number/{ticketNumber}", async (string ticketNumber, HttpContext context, TicketDbContext dbContext) =>
{
    try
    {
        // Get query parameters from the request
        var userRole = context.Request.Query["userRole"].FirstOrDefault();
        var userId = context.Request.Query["userId"].FirstOrDefault();
        
        Console.WriteLine($"🔍 Ticket Detail Request - ticketNumber: {ticketNumber}, userRole: '{userRole}', userId: '{userId}'");
        
        var ticket = await dbContext.Tickets.FirstOrDefaultAsync(t => t.TicketNumber == ticketNumber);
        
        if (ticket == null)
        {
            return Results.NotFound();
        }
        
        // If user is not admin, check if they have access to this ticket
        if (!string.IsNullOrEmpty(userRole) && userRole.ToLower() != "admin")
        {
            var hasAccess = ticket.CreatedBy == userId || ticket.AssignedTo == userId;
            Console.WriteLine($"🔒 Access check - CreatedBy: '{ticket.CreatedBy}', AssignedTo: '{ticket.AssignedTo}', userId: '{userId}', hasAccess: {hasAccess}");
            if (!hasAccess)
            {
                return Results.Json(new { error = "You do not have access to view this ticket" }, statusCode: 403);
            }
        }
        
        return Results.Ok(ticket);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error fetching ticket by number: {ex.Message}");
        return Results.Problem($"Error fetching ticket: {ex.Message}");
    }
});

app.MapPost("/api/tickets", async (CreateTicketRequest request, TicketDbContext context) =>
{
    try
{
    var ticket = new Ticket
    {
        TicketNumber = await GenerateTicketNumber(context),
        ReporterName = request.ReporterName,
        ContactNumber = request.ContactNumber,
        Branch = request.Branch,
        IssueType = request.IssueType,
        ReportedIssue = request.ReportedIssue,
        Attachment = request.Attachments,  // Maps request.Attachments to Ticket.Attachment column
        DateOfTicket = request.DateOfTicket,
        TicketOpenTime = DateTime.Now,
        Status = "Open",
        Priority = request.Priority,
        AssignedTo = "Admin", // Default admin
        CreatedBy = !string.IsNullOrEmpty(request.CreatedBy) ? request.CreatedBy : request.ReporterName,
        CreatedDate = DateTime.Now
    };

    context.Tickets.Add(ticket);
    await context.SaveChangesAsync();

    return Results.Created($"/api/tickets/{ticket.Id}", ticket);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error creating ticket: {ex.Message}");
        return Results.Problem($"Error creating ticket: {ex.Message}");
    }
});

app.MapPut("/api/tickets/{id}", async (int id, UpdateTicketRequest request, HttpContext httpContext, TicketDbContext context) =>
{
    try
    {
        // Get user information from query parameters
        var userRole = httpContext.Request.Query["userRole"].FirstOrDefault();
        var userId = httpContext.Request.Query["userId"].FirstOrDefault();
        
        Console.WriteLine($"🔍 Update Request - ticketId: {id}, userRole: '{userRole}', userId: '{userId}'");
        
    var ticket = await context.Tickets.FindAsync(id);
    if (ticket == null) return Results.NotFound();

        // Check if user has permission to edit this ticket
        if (!string.IsNullOrEmpty(userRole) && userRole.ToLower() != "admin")
        {
            var hasPermission = ticket.CreatedBy == userId || ticket.AssignedTo == userId;
            Console.WriteLine($"🔒 Permission check - CreatedBy: '{ticket.CreatedBy}', AssignedTo: '{ticket.AssignedTo}', userId: '{userId}', hasPermission: {hasPermission}");
            
            if (!hasPermission)
            {
                return Results.Json(new { error = "You do not have permission to edit this ticket" }, statusCode: 403);
            }
        }

    ticket.ReporterName = request.ReporterName;
    ticket.ContactNumber = request.ContactNumber;
    ticket.Branch = request.Branch;
    ticket.IssueType = request.IssueType;
    ticket.ReportedIssue = request.ReportedIssue;
    if (request.Attachments != null)
        ticket.Attachment = request.Attachments;  // Update attachments if provided
    ticket.DateOfTicket = request.DateOfTicket;
    ticket.Status = request.Status;
    ticket.Priority = request.Priority;
    ticket.WorkStartTime = request.WorkStartTime;
    ticket.WorkEndTime = request.WorkEndTime;
    ticket.AssignedTo = request.AssignedTo;

    await context.SaveChangesAsync();
        Console.WriteLine($"✅ Ticket {id} updated successfully");
    return Results.Ok(ticket);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error updating ticket: {ex.Message}");
        return Results.Problem($"Error updating ticket: {ex.Message}");
    }
});

app.MapDelete("/api/tickets/{id}", async (int id, TicketDbContext context) =>
{
    var ticket = await context.Tickets.FindAsync(id);
    if (ticket == null) return Results.NotFound();

    context.Tickets.Remove(ticket);
    await context.SaveChangesAsync();
    return Results.NoContent();
});

// Issue Type API Endpoints
app.MapGet("/api/issue-types", async (TicketDbContext context, string? search = null, bool? activeOnly = null) =>
{
    try
    {
        var query = context.IssueTypes.AsQueryable();
        
        if (!string.IsNullOrEmpty(search))
        {
            query = query.Where(it => it.Name.Contains(search) || it.Description.Contains(search));
        }
        
        var result = await query.OrderBy(it => it.Name).ToListAsync();
        return Results.Ok(new { data = result, count = result.Count });
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error retrieving issue types: {ex.Message}");
    }
});

app.MapGet("/api/issue-types/{id}", async (int id, TicketDbContext context) =>
{
    try
{
    var issueType = await context.IssueTypes.FindAsync(id);
        return issueType != null ? Results.Ok(issueType) : Results.NotFound(new { message = "Issue type not found" });
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error retrieving issue type: {ex.Message}");
    }
});

app.MapPost("/api/issue-types", async (CreateIssueTypeRequest request, TicketDbContext context) =>
{
    try
    {
        // Validation
        if (string.IsNullOrWhiteSpace(request.Name))
            return Results.BadRequest(new { message = "Name is required" });
        
        if (string.IsNullOrWhiteSpace(request.Description))
            return Results.BadRequest(new { message = "Description is required" });
        
        // Check for duplicate name
        var existing = await context.IssueTypes.FirstOrDefaultAsync(it => it.Name == request.Name);
        if (existing != null)
            return Results.Conflict(new { message = "Issue type with this name already exists" });

    var issueType = new IssueType
    {
            Name = request.Name.Trim(),
            Description = request.Description.Trim()
    };

    context.IssueTypes.Add(issueType);
    await context.SaveChangesAsync();

    return Results.Created($"/api/issue-types/{issueType.Id}", issueType);
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error creating issue type: {ex.Message}");
    }
});

app.MapPut("/api/issue-types/{id}", async (int id, UpdateIssueTypeRequest request, TicketDbContext context) =>
{
    try
{
    var issueType = await context.IssueTypes.FindAsync(id);
        if (issueType == null) 
            return Results.NotFound(new { message = "Issue type not found" });

        // Validation
        if (string.IsNullOrWhiteSpace(request.Name))
            return Results.BadRequest(new { message = "Name is required" });
        
        if (string.IsNullOrWhiteSpace(request.Description))
            return Results.BadRequest(new { message = "Description is required" });

        // Check for duplicate name (excluding current record)
        var existing = await context.IssueTypes.FirstOrDefaultAsync(it => it.Name == request.Name && it.Id != id);
        if (existing != null)
            return Results.Conflict(new { message = "Issue type with this name already exists" });

        issueType.Name = request.Name.Trim();
        issueType.Description = request.Description.Trim();

    await context.SaveChangesAsync();
    return Results.Ok(issueType);
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error updating issue type: {ex.Message}");
    }
});

app.MapDelete("/api/issue-types/{id}", async (int id, TicketDbContext context) =>
{
    try
{
    var issueType = await context.IssueTypes.FindAsync(id);
        if (issueType == null) 
            return Results.NotFound(new { message = "Issue type not found" });

        // Check if issue type is being used in tickets
        var issueTypeName = await context.IssueTypes.Where(it => it.Id == id).Select(it => it.Name).FirstOrDefaultAsync();
        var isUsed = await context.Tickets.AnyAsync(t => t.IssueType == issueTypeName);
        if (isUsed)
            return Results.Conflict(new { message = "Cannot delete issue type that is being used in tickets" });

    context.IssueTypes.Remove(issueType);
    await context.SaveChangesAsync();
        return Results.Ok(new { message = "Issue type deleted successfully" });
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error deleting issue type: {ex.Message}");
    }
});

// Bulk operations for Issue Types
app.MapPost("/api/issue-types/bulk", async (BulkCreateIssueTypeRequest request, TicketDbContext context) =>
{
    try
    {
        if (request.Items == null || !request.Items.Any())
            return Results.BadRequest(new { message = "No items provided" });

        var issueTypes = new List<IssueType>();
        var errors = new List<string>();

        foreach (var item in request.Items)
        {
            if (string.IsNullOrWhiteSpace(item.Name) || string.IsNullOrWhiteSpace(item.Description))
            {
                errors.Add($"Invalid data for item: {item.Name ?? "Unknown"}");
                continue;
            }

            var existing = await context.IssueTypes.FirstOrDefaultAsync(it => it.Name == item.Name);
            if (existing != null)
            {
                errors.Add($"Issue type '{item.Name}' already exists");
                continue;
            }

            issueTypes.Add(new IssueType
            {
                Name = item.Name.Trim(),
                Description = item.Description.Trim()
            });
        }

        if (issueTypes.Any())
        {
            context.IssueTypes.AddRange(issueTypes);
            await context.SaveChangesAsync();
        }

        return Results.Ok(new { 
            created = issueTypes.Count, 
            errors = errors,
            data = issueTypes 
        });
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error creating issue types in bulk: {ex.Message}");
    }
});

// Branch API Endpoints
app.MapGet("/api/branches", async (TicketDbContext context, string? search = null, bool? activeOnly = null) =>
{
    try
    {
        var query = context.Branches.AsQueryable();
        
        if (!string.IsNullOrEmpty(search))
        {
            query = query.Where(b => b.Name.Contains(search) || b.Code.Contains(search) || b.Address.Contains(search));
        }
        
        if (activeOnly == true)
        {
            query = query.Where(b => b.IsActive);
        }
        
        var result = await query.OrderBy(b => b.Name).ToListAsync();
        return Results.Ok(new { data = result, count = result.Count });
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error retrieving branches: {ex.Message}");
    }
});

app.MapGet("/api/branches/{id}", async (int id, TicketDbContext context) =>
{
    try
{
    var branch = await context.Branches.FindAsync(id);
        return branch != null ? Results.Ok(branch) : Results.NotFound(new { message = "Branch not found" });
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error retrieving branch: {ex.Message}");
    }
});

app.MapPost("/api/branches", async (CreateBranchRequest request, TicketDbContext context) =>
{
    try
    {
        // Validation
        if (string.IsNullOrWhiteSpace(request.Name))
            return Results.BadRequest(new { message = "Name is required" });
        
        if (string.IsNullOrWhiteSpace(request.Code))
            return Results.BadRequest(new { message = "Code is required" });
        
        // Check for duplicate name or code
        var existingName = await context.Branches.FirstOrDefaultAsync(b => b.Name == request.Name);
        if (existingName != null)
            return Results.Conflict(new { message = "Branch with this name already exists" });
            
        var existingCode = await context.Branches.FirstOrDefaultAsync(b => b.Code == request.Code);
        if (existingCode != null)
            return Results.Conflict(new { message = "Branch with this code already exists" });

    var branch = new Branch
    {
            Name = request.Name.Trim(),
            Code = request.Code.Trim().ToUpper(),
            Address = request.Address?.Trim() ?? "",
            ContactNumber = request.ContactNumber?.Trim() ?? "",
            IsActive = true
    };

    context.Branches.Add(branch);
    await context.SaveChangesAsync();

    return Results.Created($"/api/branches/{branch.Id}", branch);
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error creating branch: {ex.Message}");
    }
});

app.MapPut("/api/branches/{id}", async (int id, UpdateBranchRequest request, TicketDbContext context) =>
{
    try
{
    var branch = await context.Branches.FindAsync(id);
        if (branch == null) 
            return Results.NotFound(new { message = "Branch not found" });

        // Validation
        if (string.IsNullOrWhiteSpace(request.Name))
            return Results.BadRequest(new { message = "Name is required" });
        
        if (string.IsNullOrWhiteSpace(request.Code))
            return Results.BadRequest(new { message = "Code is required" });

        // Check for duplicate name or code (excluding current record)
        var existingName = await context.Branches.FirstOrDefaultAsync(b => b.Name == request.Name && b.Id != id);
        if (existingName != null)
            return Results.Conflict(new { message = "Branch with this name already exists" });
            
        var existingCode = await context.Branches.FirstOrDefaultAsync(b => b.Code == request.Code && b.Id != id);
        if (existingCode != null)
            return Results.Conflict(new { message = "Branch with this code already exists" });

        branch.Name = request.Name.Trim();
        branch.Code = request.Code.Trim().ToUpper();
        branch.Address = request.Address?.Trim() ?? "";
        branch.ContactNumber = request.ContactNumber?.Trim() ?? "";
    branch.IsActive = request.IsActive;

    await context.SaveChangesAsync();
    return Results.Ok(branch);
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error updating branch: {ex.Message}");
    }
});

app.MapDelete("/api/branches/{id}", async (int id, TicketDbContext context) =>
{
    try
{
    var branch = await context.Branches.FindAsync(id);
        if (branch == null) 
            return Results.NotFound(new { message = "Branch not found" });

        // Check if branch is being used in tickets
        var branchName = await context.Branches.Where(b => b.Id == id).Select(b => b.Name).FirstOrDefaultAsync();
        var isUsed = await context.Tickets.AnyAsync(t => t.Branch == branchName);
        if (isUsed)
            return Results.Conflict(new { message = "Cannot delete branch that is being used in tickets" });

    context.Branches.Remove(branch);
    await context.SaveChangesAsync();
        return Results.Ok(new { message = "Branch deleted successfully" });
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error deleting branch: {ex.Message}");
    }
});

// Bulk operations for Branches
app.MapPost("/api/branches/bulk", async (BulkCreateBranchRequest request, TicketDbContext context) =>
{
    try
    {
        if (request.Items == null || !request.Items.Any())
            return Results.BadRequest(new { message = "No items provided" });

        var branches = new List<Branch>();
        var errors = new List<string>();

        foreach (var item in request.Items)
        {
            if (string.IsNullOrWhiteSpace(item.Name) || string.IsNullOrWhiteSpace(item.Code))
            {
                errors.Add($"Invalid data for item: {item.Name ?? "Unknown"}");
                continue;
            }

            var existing = await context.Branches.FirstOrDefaultAsync(b => b.Name == item.Name || b.Code == item.Code);
            if (existing != null)
            {
                errors.Add($"Branch '{item.Name}' or code '{item.Code}' already exists");
                continue;
            }

            branches.Add(new Branch
            {
                Name = item.Name.Trim(),
                Code = item.Code.Trim().ToUpper(),
                Address = item.Address?.Trim() ?? "",
                ContactNumber = item.ContactNumber?.Trim() ?? "",
                IsActive = true
            });
        }

        if (branches.Any())
        {
            context.Branches.AddRange(branches);
            await context.SaveChangesAsync();
        }

        return Results.Ok(new { 
            created = branches.Count, 
            errors = errors,
            data = branches 
        });
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error creating branches in bulk: {ex.Message}");
    }
});

// Priority API Endpoints
app.MapGet("/api/priorities", async (TicketDbContext context, string? search = null, int? level = null) =>
{
    try
    {
        var query = context.Priorities.AsQueryable();
        
        if (!string.IsNullOrEmpty(search))
        {
            query = query.Where(p => p.Name.Contains(search) || p.Description.Contains(search));
        }
        
        if (level.HasValue)
        {
            query = query.Where(p => p.Level == level.Value);
        }
        
        var result = await query.OrderBy(p => p.Level).ThenBy(p => p.Name).ToListAsync();
        return Results.Ok(new { data = result, count = result.Count });
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error retrieving priorities: {ex.Message}");
    }
});

app.MapGet("/api/priorities/{id}", async (int id, TicketDbContext context) =>
{
    try
{
    var priority = await context.Priorities.FindAsync(id);
        return priority != null ? Results.Ok(priority) : Results.NotFound(new { message = "Priority not found" });
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error retrieving priority: {ex.Message}");
    }
});

app.MapPost("/api/priorities", async (CreatePriorityRequest request, TicketDbContext context) =>
{
    try
    {
        // Validation
        if (string.IsNullOrWhiteSpace(request.Name))
            return Results.BadRequest(new { message = "Name is required" });
        
        if (string.IsNullOrWhiteSpace(request.Description))
            return Results.BadRequest(new { message = "Description is required" });
        
        if (request.Level < 1 || request.Level > 5)
            return Results.BadRequest(new { message = "Level must be between 1 and 5" });
        
        if (string.IsNullOrWhiteSpace(request.Color))
            return Results.BadRequest(new { message = "Color is required" });
        
        // Check for duplicate name
        var existingName = await context.Priorities.FirstOrDefaultAsync(p => p.Name == request.Name);
        if (existingName != null)
            return Results.Conflict(new { message = "Priority with this name already exists" });
            
        // Check for duplicate level
        var existingLevel = await context.Priorities.FirstOrDefaultAsync(p => p.Level == request.Level);
        if (existingLevel != null)
            return Results.Conflict(new { message = "Priority with this level already exists" });

    var priority = new Priority
    {
            Name = request.Name.Trim(),
            Description = request.Description.Trim(),
        Level = request.Level,
            Color = request.Color.Trim()
    };

    context.Priorities.Add(priority);
    await context.SaveChangesAsync();

    return Results.Created($"/api/priorities/{priority.Id}", priority);
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error creating priority: {ex.Message}");
    }
});

app.MapPut("/api/priorities/{id}", async (int id, UpdatePriorityRequest request, TicketDbContext context) =>
{
    try
{
    var priority = await context.Priorities.FindAsync(id);
        if (priority == null) 
            return Results.NotFound(new { message = "Priority not found" });

        // Validation
        if (string.IsNullOrWhiteSpace(request.Name))
            return Results.BadRequest(new { message = "Name is required" });
        
        if (string.IsNullOrWhiteSpace(request.Description))
            return Results.BadRequest(new { message = "Description is required" });
        
        if (request.Level < 1 || request.Level > 5)
            return Results.BadRequest(new { message = "Level must be between 1 and 5" });
        
        if (string.IsNullOrWhiteSpace(request.Color))
            return Results.BadRequest(new { message = "Color is required" });

        // Check for duplicate name (excluding current record)
        var existingName = await context.Priorities.FirstOrDefaultAsync(p => p.Name == request.Name && p.Id != id);
        if (existingName != null)
            return Results.Conflict(new { message = "Priority with this name already exists" });
            
        // Check for duplicate level (excluding current record)
        var existingLevel = await context.Priorities.FirstOrDefaultAsync(p => p.Level == request.Level && p.Id != id);
        if (existingLevel != null)
            return Results.Conflict(new { message = "Priority with this level already exists" });

        priority.Name = request.Name.Trim();
        priority.Description = request.Description.Trim();
    priority.Level = request.Level;
        priority.Color = request.Color.Trim();

    await context.SaveChangesAsync();
    return Results.Ok(priority);
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error updating priority: {ex.Message}");
    }
});

app.MapDelete("/api/priorities/{id}", async (int id, TicketDbContext context) =>
{
    try
{
    var priority = await context.Priorities.FindAsync(id);
        if (priority == null) 
            return Results.NotFound(new { message = "Priority not found" });

        // Check if priority is being used in tickets
        var priorityName = await context.Priorities.Where(p => p.Id == id).Select(p => p.Name).FirstOrDefaultAsync();
        var isUsed = await context.Tickets.AnyAsync(t => t.Priority == priorityName);
        if (isUsed)
            return Results.Conflict(new { message = "Cannot delete priority that is being used in tickets" });

    context.Priorities.Remove(priority);
    await context.SaveChangesAsync();
        return Results.Ok(new { message = "Priority deleted successfully" });
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error deleting priority: {ex.Message}");
    }
});

// Bulk operations for Priorities
app.MapPost("/api/priorities/bulk", async (BulkCreatePriorityRequest request, TicketDbContext context) =>
{
    try
    {
        if (request.Items == null || !request.Items.Any())
            return Results.BadRequest(new { message = "No items provided" });

        var priorities = new List<Priority>();
        var errors = new List<string>();

        foreach (var item in request.Items)
        {
            if (string.IsNullOrWhiteSpace(item.Name) || string.IsNullOrWhiteSpace(item.Description) || 
                item.Level < 1 || item.Level > 5 || string.IsNullOrWhiteSpace(item.Color))
            {
                errors.Add($"Invalid data for item: {item.Name ?? "Unknown"}");
                continue;
            }

            var existing = await context.Priorities.FirstOrDefaultAsync(p => p.Name == item.Name || p.Level == item.Level);
            if (existing != null)
            {
                errors.Add($"Priority '{item.Name}' or level {item.Level} already exists");
                continue;
            }

            priorities.Add(new Priority
            {
                Name = item.Name.Trim(),
                Description = item.Description.Trim(),
                Level = item.Level,
                Color = item.Color.Trim()
            });
        }

        if (priorities.Any())
        {
            context.Priorities.AddRange(priorities);
            await context.SaveChangesAsync();
        }

        return Results.Ok(new { 
            created = priorities.Count, 
            errors = errors,
            data = priorities 
        });
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error creating priorities in bulk: {ex.Message}");
    }
});

// RPC Branches API Endpoint - Fetches branches from external RPC database
app.MapGet("/api/rpc/branches", async (RpcDbContext rpcContext, string? search = null) =>
{
    try
    {
        Console.WriteLine("🔍 Fetching branches from RPC database...");
        Console.WriteLine($"🔍 Connection: 203.151.66.69:1433 (default), Database: RPCMaster");
        
        // Try using raw SQL to query the table directly
        try
        {
            Console.WriteLine("🔍 Testing database connection...");
            
            bool canConnect = false;
            Exception? connectionException = null;
            
            try
            {
                canConnect = await rpcContext.Database.CanConnectAsync();
            }
            catch (Exception connEx)
            {
                connectionException = connEx;
                canConnect = false;
            }
            
            Console.WriteLine($"🔍 Database connection: {(canConnect ? "SUCCESS" : "FAILED")}");
            
            if (!canConnect)
            {
                Console.WriteLine("❌ Cannot connect to RPC database");
                
                if (connectionException != null)
                {
                    Console.WriteLine($"❌ Connection Error: {connectionException.Message}");
                    if (connectionException.InnerException != null)
                    {
                        Console.WriteLine($"❌ Inner Error: {connectionException.InnerException.Message}");
                    }
                }
                
                return Results.Problem("Cannot connect to RPC database. Please check your connection.");
            }
            
            // Try querying with raw SQL to handle the dbo.StoresMaster_Main format
            Console.WriteLine("🔍 Attempting to query dbo.StoresMaster_Main...");
            var sqlQuery = "SELECT No, StoreName, StoreCode FROM dbo.StoresMaster_Main WHERE Status = 'Operating' ORDER BY StoreName";
            
            var connection = rpcContext.Database.GetDbConnection();
            await connection.OpenAsync();
            
            using var command = connection.CreateCommand();
            command.CommandText = sqlQuery;
            
            var branches = new List<object>();
            using var reader = await command.ExecuteReaderAsync();
            
            while (await reader.ReadAsync())
            {
                branches.Add(new 
                {
                    id = reader.GetInt32(0),           // No column
                    name = reader.GetString(1),         // StoreName column
                    code = reader.GetString(2)          // StoreCode column
                });
            }
            
            await connection.CloseAsync();
            
            if (branches.Count > 0)
            {
                Console.WriteLine($"✅ Found {branches.Count} branches from RPC database using raw SQL");
                Console.WriteLine($"✅ First branch: {((dynamic)branches[0]).name}");
                return Results.Ok(branches);
            }
            else
            {
                Console.WriteLine("⚠️ No branches found in database");
                return Results.Ok(new List<object>());  // Return empty array instead of test data
            }
        }
        catch (Exception connEx)
        {
            Console.WriteLine($"❌ Connection/Query failed!");
            Console.WriteLine($"❌ Error: {connEx.Message}");
            if (connEx.InnerException != null)
            {
                Console.WriteLine($"❌ Inner Error: {connEx.InnerException.Message}");
            }
            Console.WriteLine($"❌ Error Type: {connEx.GetType().Name}");
            return Results.Problem($"Failed to fetch branches from database: {connEx.Message}");
        }
        
        // This code path shouldn't be reached due to the raw SQL above, but keep as fallback
        var query = rpcContext.StoresMaster_Main.AsQueryable();
        
        // Apply search filter if provided
        if (!string.IsNullOrEmpty(search))
        {
            query = query.Where(s => s.StoreName.Contains(search));
        }
        
        var stores = await query
            .Where(s => s.Status == "Operating")
            .OrderBy(s => s.StoreName)
            .Select(s => new 
            {
                id = s.No,
                name = s.StoreName,
                code = s.StoreCode
            })
            .ToListAsync();
        
        Console.WriteLine($"✅ Found {stores.Count} branches from RPC database");
        
        if (stores.Count > 0)
        {
            Console.WriteLine($"✅ Sample branch: {stores[0].name}");
        }
        
        return Results.Ok(stores);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"❌ Error fetching RPC branches: {ex.Message}");
        Console.WriteLine($"❌ Stack trace: {ex.StackTrace}");
        Console.WriteLine($"❌ Inner exception: {ex.InnerException?.Message}");
        return Results.Problem($"Failed to fetch branches: {ex.Message}");
    }
});

// RPC Users API Endpoint - Fetches users from RpcWebsite database by token
app.MapGet("/api/rpc", async (HttpContext context, RpcWebsiteDbContext rpcWebsiteContext) =>
{
    try
    {
        var token = context.Request.Query["token"].FirstOrDefault();
        if (string.IsNullOrEmpty(token))
        {
            return Results.BadRequest(new { error = "Token is required." });
        }

        Console.WriteLine($"🔍 Fetching RPC users with token: {token}");

        // First, let's check what ShareTokens exist in the database
        var allTokens = await rpcWebsiteContext.Database
            .SqlQueryRaw<string>("SELECT TOP 5 ShareToken FROM dbo.Users WHERE ShareToken IS NOT NULL")
            .ToListAsync();
        
        Console.WriteLine($"🔍 Found {allTokens.Count} ShareTokens in database:");
        foreach (var t in allTokens)
        {
            Console.WriteLine($"  - {t}");
        }

        // Query real data from RpcWebsite.dbo.Users table
        var users = new List<RpcUser>();
        
        try
        {
            // Use raw SQL to get real user data with specific columns
            var sql = @"
                SELECT Username, BU, LoginType, PasswordLogin, [Level], Empid, ShareToken, 
                       SubDepartment_Company, DeptCode, SubDept, Name_EN, Position, Phone
                FROM dbo.Users 
                WHERE ShareToken = @token";

            using (var connection = rpcWebsiteContext.Database.GetDbConnection())
            {
                await connection.OpenAsync();
                using (var command = connection.CreateCommand())
                {
                    command.CommandText = sql;
                    command.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@token", token));
                    
                    using (var reader = await command.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            users.Add(new RpcUser
                            {
                                Username = reader["Username"]?.ToString() ?? "",
                                BU = reader["BU"]?.ToString() ?? "",
                                LoginType = reader["LoginType"]?.ToString() ?? "",
                                PasswordLogin = reader["PasswordLogin"]?.ToString() ?? "",
                                Level = reader["Level"]?.ToString() ?? "",
                                Empid = reader["Empid"]?.ToString() ?? "",
                                ShareToken = reader["ShareToken"]?.ToString() ?? "",
                                SubDepartment_Company = reader["SubDepartment_Company"]?.ToString() ?? "",
                                DeptCode = reader["DeptCode"]?.ToString() ?? "",
                                SubDept = reader["SubDept"]?.ToString() ?? "",
                                Name_EN = reader["Name_EN"]?.ToString() ?? "",
                                Position = reader["Position"]?.ToString() ?? "",
                                Phone = reader["Phone"]?.ToString() ?? ""
                            });
                        }
                    }
                }
            }
        }
        catch (Exception dbEx)
        {
            Console.WriteLine($"❌ Database query failed: {dbEx.Message}");
            // If database query fails, return empty list
            users = new List<RpcUser>();
        }

        Console.WriteLine($"✅ Found {users.Count} users with token: {token}");
        return Results.Ok(users);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"❌ Error fetching RPC users: {ex.Message}");
        return Results.Problem($"Failed to fetch RPC users: {ex.Message}");
    }
});

// Duplicate endpoint for backward compatibility - RPC Users API Endpoint
app.MapGet("/api/rpc/users", async (HttpContext context, RpcWebsiteDbContext rpcWebsiteContext) =>
{
    try
    {
        var token = context.Request.Query["token"].FirstOrDefault();
        if (string.IsNullOrEmpty(token))
        {
            return Results.BadRequest(new { error = "Token is required." });
        }

        Console.WriteLine($"🔍 Fetching RPC users with token: {token}");

        // Query real data from RpcWebsite.dbo.Users table
        var users = new List<RpcUser>();
        
        try
        {
            // Use raw SQL to get real user data with specific columns
            var sql = @"
                SELECT Username, BU, LoginType, PasswordLogin, [Level], Empid, ShareToken, 
                       SubDepartment_Company, DeptCode, SubDept, Name_EN, Position, Phone
                FROM dbo.Users 
                WHERE ShareToken = @token";

            using (var connection = rpcWebsiteContext.Database.GetDbConnection())
            {
                await connection.OpenAsync();
                using (var command = connection.CreateCommand())
                {
                    command.CommandText = sql;
                    command.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@token", token));
                    
                    using (var reader = await command.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            users.Add(new RpcUser
                            {
                                Username = reader["Username"]?.ToString() ?? "",
                                BU = reader["BU"]?.ToString() ?? "",
                                LoginType = reader["LoginType"]?.ToString() ?? "",
                                PasswordLogin = reader["PasswordLogin"]?.ToString() ?? "",
                                Level = reader["Level"]?.ToString() ?? "",
                                Empid = reader["Empid"]?.ToString() ?? "",
                                ShareToken = reader["ShareToken"]?.ToString() ?? "",
                                SubDepartment_Company = reader["SubDepartment_Company"]?.ToString() ?? "",
                                DeptCode = reader["DeptCode"]?.ToString() ?? "",
                                SubDept = reader["SubDept"]?.ToString() ?? "",
                                Name_EN = reader["Name_EN"]?.ToString() ?? "",
                                Position = reader["Position"]?.ToString() ?? "",
                                Phone = reader["Phone"]?.ToString() ?? ""
                            });
                        }
                    }
                }
            }
        }
        catch (Exception dbEx)
        {
            Console.WriteLine($"❌ Database query failed: {dbEx.Message}");
            // If database query fails, return empty list
            users = new List<RpcUser>();
        }

        Console.WriteLine($"✅ Found {users.Count} users with token: {token}");
        return Results.Ok(users);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"❌ Error fetching RPC users: {ex.Message}");
        return Results.Problem($"Failed to fetch RPC users: {ex.Message}");
    }
});

// Helper endpoint to show available ShareTokens
app.MapGet("/api/rpc/tokens", async (RpcWebsiteDbContext rpcWebsiteContext) =>
{
    try
    {
        Console.WriteLine("🔍 Fetching available ShareTokens from database...");
        
        var tokens = await rpcWebsiteContext.Database
            .SqlQueryRaw<string>("SELECT TOP 10 ShareToken FROM dbo.Users WHERE ShareToken IS NOT NULL AND ShareToken != '' ORDER BY ShareToken")
            .ToListAsync();
        
        Console.WriteLine($"✅ Found {tokens.Count} ShareTokens in database");
        return Results.Ok(new { 
            message = "Available ShareTokens in database",
            count = tokens.Count,
            tokens = tokens 
        });
    }
    catch (Exception ex)
    {
        Console.WriteLine($"❌ Error fetching ShareTokens: {ex.Message}");
        return Results.Problem($"Failed to fetch ShareTokens: {ex.Message}");
    }
});

// Token validation endpoint - checks if token exists and returns user info
app.MapGet("/api/validate-token", async (HttpContext context, RpcWebsiteDbContext rpcWebsiteContext) =>
{
    try
    {
        var token = context.Request.Query["token"].FirstOrDefault();
        if (string.IsNullOrEmpty(token))
        {
            return Results.BadRequest(new { error = "Token is required.", valid = false });
        }

        Console.WriteLine($"🔍 Validating token: {token}");

        // Check if token exists in database
        var sql = @"
            SELECT TOP 1 Username, BU, LoginType, PasswordLogin, [Level], Empid, ShareToken, 
                   SubDepartment_Company, DeptCode, SubDept 
            FROM dbo.Users 
            WHERE ShareToken = @token";

        using (var connection = rpcWebsiteContext.Database.GetDbConnection())
        {
            await connection.OpenAsync();
            using (var command = connection.CreateCommand())
            {
                command.CommandText = sql;
                command.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@token", token));
                
                using (var reader = await command.ExecuteReaderAsync())
                {
                    if (await reader.ReadAsync())
                    {
                        var user = new RpcUser
                        {
                            Username = reader["Username"]?.ToString() ?? "",
                            BU = reader["BU"]?.ToString() ?? "",
                            LoginType = reader["LoginType"]?.ToString() ?? "",
                            PasswordLogin = reader["PasswordLogin"]?.ToString() ?? "",
                            Level = reader["Level"]?.ToString() ?? "",
                            Empid = reader["Empid"]?.ToString() ?? "",
                            ShareToken = reader["ShareToken"]?.ToString() ?? "",
                            SubDepartment_Company = reader["SubDepartment_Company"]?.ToString() ?? "",
                            DeptCode = reader["DeptCode"]?.ToString() ?? "",
                            SubDept = reader["SubDept"]?.ToString() ?? ""
                        };

                        Console.WriteLine($"✅ Token valid - User: {user.Username}");
                        return Results.Ok(new { valid = true, user = user });
                    }
                }
            }
        }

        Console.WriteLine($"❌ Token invalid: {token}");
        return Results.Ok(new { valid = false, message = "Token not found" });
    }
    catch (Exception ex)
    {
        Console.WriteLine($"❌ Error validating token: {ex.Message}");
        return Results.Problem($"Failed to validate token: {ex.Message}");
    }
});

// Microsoft authentication endpoint - validates Microsoft user against RPC database
app.MapPost("/api/auth/microsoft", async (HttpContext context, RpcWebsiteDbContext rpcWebsiteContext) =>
{
    try
    {
        using var reader = new StreamReader(context.Request.Body);
        var requestBody = await reader.ReadToEndAsync();
        var requestData = System.Text.Json.JsonSerializer.Deserialize<MicrosoftAuthRequest>(requestBody);
        
        if (requestData == null || string.IsNullOrEmpty(requestData.Email))
        {
            return Results.BadRequest(new { error = "Email is required.", valid = false });
        }

        Console.WriteLine($"🔍 Microsoft authentication for email: {requestData.Email}");

        // Search for user in RPC database by email with complete user data
        var sql = @"
            SELECT TOP 1 Username, BU, LoginType, PasswordLogin, [Level], Empid, Job_Grade, 
                   Workplaceid, Name_EN, Position, HQ_Status, Location, Location_Code, 
                   Department, Department_Company, MgrEmpid, Phone, RocksTokenPoint, 
                   EmailNotification, Enable_Status, DOB, StartDate, ResignDate, 
                   Lastlogin, ShareToken, SubDepartment_Company, DeptCode, SubDept 
            FROM dbo.Users 
            WHERE Username = @email OR Username LIKE @emailPattern";

        using (var connection = rpcWebsiteContext.Database.GetDbConnection())
        {
            await connection.OpenAsync();
            using (var command = connection.CreateCommand())
            {
                command.CommandText = sql;
                command.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@email", requestData.Email));
                command.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@emailPattern", "%" + requestData.Email + "%"));
                
                using (var dataReader = await command.ExecuteReaderAsync())
                {
                    if (await dataReader.ReadAsync())
                    {
                        var rpcUser = new RpcUser
                        {
                            Username = dataReader["Username"]?.ToString() ?? "",
                            BU = dataReader["BU"]?.ToString() ?? "",
                            LoginType = dataReader["LoginType"]?.ToString() ?? "",
                            PasswordLogin = dataReader["PasswordLogin"]?.ToString() ?? "",
                            Level = dataReader["Level"]?.ToString() ?? "",
                            Empid = dataReader["Empid"]?.ToString() ?? "",
                            Job_Grade = dataReader["Job_Grade"]?.ToString() ?? "",
                            Workplaceid = dataReader["Workplaceid"]?.ToString() ?? "",
                            Name_EN = dataReader["Name_EN"]?.ToString() ?? "",
                            Position = dataReader["Position"]?.ToString() ?? "",
                            HQ_Status = dataReader["HQ_Status"]?.ToString() ?? "",
                            Location = dataReader["Location"]?.ToString() ?? "",
                            Location_Code = dataReader["Location_Code"]?.ToString() ?? "",
                            Department = dataReader["Department"]?.ToString() ?? "",
                            Department_Company = dataReader["Department_Company"]?.ToString() ?? "",
                            MgrEmpid = dataReader["MgrEmpid"]?.ToString() ?? "",
                            Phone = dataReader["Phone"]?.ToString() ?? "",
                            RocksTokenPoint = dataReader["RocksTokenPoint"]?.ToString() ?? "",
                            EmailNotification = dataReader["EmailNotification"]?.ToString() ?? "",
                            Enable_Status = dataReader["Enable_Status"]?.ToString() ?? "",
                            DOB = dataReader["DOB"]?.ToString() ?? "",
                            StartDate = dataReader["StartDate"]?.ToString() ?? "",
                            ResignDate = dataReader["ResignDate"]?.ToString() ?? "",
                            Lastlogin = dataReader["Lastlogin"]?.ToString() ?? "",
                            ShareToken = dataReader["ShareToken"]?.ToString() ?? "",
                            SubDepartment_Company = dataReader["SubDepartment_Company"]?.ToString() ?? "",
                            DeptCode = dataReader["DeptCode"]?.ToString() ?? "",
                            SubDept = dataReader["SubDept"]?.ToString() ?? ""
                        };

                        Console.WriteLine($"✅ Microsoft user found in RPC database: {rpcUser.Username}");
                        
                        // Create user data for frontend with comprehensive RPC user data
                        var userData = new
                        {
                            username = rpcUser.Username,
                            fullName = !string.IsNullOrEmpty(rpcUser.Name_EN) ? rpcUser.Name_EN : rpcUser.Username,
                            email = rpcUser.Username,
                            role = rpcUser.Level == "100" ? "admin" : "user",
                            department = !string.IsNullOrEmpty(rpcUser.SubDepartment_Company) ? rpcUser.SubDepartment_Company : (!string.IsNullOrEmpty(rpcUser.Department_Company) ? rpcUser.Department_Company : (!string.IsNullOrEmpty(rpcUser.Department) ? rpcUser.Department : "IT")),
                            phone = rpcUser.Phone,
                            empid = rpcUser.Empid,
                            bu = rpcUser.BU,
                            position = rpcUser.Position,
                            shareToken = rpcUser.ShareToken,
                            // Additional RPC user fields
                            jobGrade = rpcUser.Job_Grade,
                            workplaceid = rpcUser.Workplaceid,
                            hqStatus = rpcUser.HQ_Status,
                            location = rpcUser.Location,
                            locationCode = rpcUser.Location_Code,
                            mgrEmpid = rpcUser.MgrEmpid,
                            rocksTokenPoint = rpcUser.RocksTokenPoint,
                            emailNotification = rpcUser.EmailNotification,
                            enableStatus = rpcUser.Enable_Status,
                            dob = rpcUser.DOB,
                            startDate = rpcUser.StartDate,
                            resignDate = rpcUser.ResignDate,
                            lastlogin = rpcUser.Lastlogin,
                            subDepartmentCompany = rpcUser.SubDepartment_Company,
                            deptCode = rpcUser.DeptCode,
                            subDept = rpcUser.SubDept
                        };

                        return Results.Ok(new { valid = true, user = userData });
                    }
                }
            }
        }

        Console.WriteLine($"❌ Microsoft user not found in RPC database: {requestData.Email}");
        return Results.Ok(new { valid = false, message = "User not found in RPC database" });
    }
    catch (Exception ex)
    {
        Console.WriteLine($"❌ Error authenticating Microsoft user: {ex.Message}");
        return Results.Problem($"Failed to authenticate user: {ex.Message}");
    }
});

// Status API Endpoints
app.MapGet("/api/statuses", async (TicketDbContext context, string? search = null, bool? activeOnly = null) =>
{
    try
    {
        var query = context.Statuses.AsQueryable();
        
        if (!string.IsNullOrEmpty(search))
        {
            query = query.Where(s => s.Name.Contains(search) || s.Description.Contains(search));
        }
        
        if (activeOnly == true)
        {
            query = query.Where(s => s.IsActive);
        }
        
        var result = await query.OrderBy(s => s.Name).ToListAsync();
        return Results.Ok(new { data = result, count = result.Count });
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error retrieving statuses: {ex.Message}");
    }
});

app.MapGet("/api/statuses/{id}", async (int id, TicketDbContext context) =>
{
    try
{
    var status = await context.Statuses.FindAsync(id);
        return status != null ? Results.Ok(status) : Results.NotFound(new { message = "Status not found" });
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error retrieving status: {ex.Message}");
    }
});

app.MapPost("/api/statuses", async (CreateStatusRequest request, TicketDbContext context) =>
{
    try
    {
        // Validation
        if (string.IsNullOrWhiteSpace(request.Name))
            return Results.BadRequest(new { message = "Name is required" });
        
        if (string.IsNullOrWhiteSpace(request.Description))
            return Results.BadRequest(new { message = "Description is required" });
        
        if (string.IsNullOrWhiteSpace(request.Color))
            return Results.BadRequest(new { message = "Color is required" });
        
        // Check for duplicate name
        var existing = await context.Statuses.FirstOrDefaultAsync(s => s.Name == request.Name);
        if (existing != null)
            return Results.Conflict(new { message = "Status with this name already exists" });

    var status = new Status
    {
            Name = request.Name.Trim(),
            Description = request.Description.Trim(),
            Color = request.Color.Trim(),
            IsActive = true
    };

    context.Statuses.Add(status);
    await context.SaveChangesAsync();

    return Results.Created($"/api/statuses/{status.Id}", status);
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error creating status: {ex.Message}");
    }
});

app.MapPut("/api/statuses/{id}", async (int id, UpdateStatusRequest request, TicketDbContext context) =>
{
    try
{
    var status = await context.Statuses.FindAsync(id);
        if (status == null) 
            return Results.NotFound(new { message = "Status not found" });

        // Validation
        if (string.IsNullOrWhiteSpace(request.Name))
            return Results.BadRequest(new { message = "Name is required" });
        
        if (string.IsNullOrWhiteSpace(request.Description))
            return Results.BadRequest(new { message = "Description is required" });
        
        if (string.IsNullOrWhiteSpace(request.Color))
            return Results.BadRequest(new { message = "Color is required" });

        // Check for duplicate name (excluding current record)
        var existing = await context.Statuses.FirstOrDefaultAsync(s => s.Name == request.Name && s.Id != id);
        if (existing != null)
            return Results.Conflict(new { message = "Status with this name already exists" });

        status.Name = request.Name.Trim();
        status.Description = request.Description.Trim();
        status.Color = request.Color.Trim();
    status.IsActive = request.IsActive;

    await context.SaveChangesAsync();
    return Results.Ok(status);
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error updating status: {ex.Message}");
    }
});

app.MapDelete("/api/statuses/{id}", async (int id, TicketDbContext context) =>
{
    try
{
    var status = await context.Statuses.FindAsync(id);
        if (status == null) 
            return Results.NotFound(new { message = "Status not found" });

        // Check if status is being used in tickets
        var statusName = await context.Statuses.Where(s => s.Id == id).Select(s => s.Name).FirstOrDefaultAsync();
        var isUsed = await context.Tickets.AnyAsync(t => t.Status == statusName);
        if (isUsed)
            return Results.Conflict(new { message = "Cannot delete status that is being used in tickets" });

    context.Statuses.Remove(status);
    await context.SaveChangesAsync();
        return Results.Ok(new { message = "Status deleted successfully" });
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error deleting status: {ex.Message}");
    }
});

// Bulk operations for Statuses
app.MapPost("/api/statuses/bulk", async (BulkCreateStatusRequest request, TicketDbContext context) =>
{
    try
    {
        if (request.Items == null || !request.Items.Any())
            return Results.BadRequest(new { message = "No items provided" });

        var statuses = new List<Status>();
        var errors = new List<string>();

        foreach (var item in request.Items)
        {
            if (string.IsNullOrWhiteSpace(item.Name) || string.IsNullOrWhiteSpace(item.Description) || 
                string.IsNullOrWhiteSpace(item.Color))
            {
                errors.Add($"Invalid data for item: {item.Name ?? "Unknown"}");
                continue;
            }

            var existing = await context.Statuses.FirstOrDefaultAsync(s => s.Name == item.Name);
            if (existing != null)
            {
                errors.Add($"Status '{item.Name}' already exists");
                continue;
            }

            statuses.Add(new Status
            {
                Name = item.Name.Trim(),
                Description = item.Description.Trim(),
                Color = item.Color.Trim(),
                IsActive = true
            });
        }

        if (statuses.Any())
        {
            context.Statuses.AddRange(statuses);
            await context.SaveChangesAsync();
        }

        return Results.Ok(new { 
            created = statuses.Count, 
            errors = errors,
            data = statuses 
        });
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error creating statuses in bulk: {ex.Message}");
    }
});

// Master Data Utility Endpoints
app.MapGet("/api/master-data/summary", async (TicketDbContext context) =>
{
    try
    {
        var summary = new
        {
            issueTypes = await context.IssueTypes.CountAsync(),
            branches = await context.Branches.CountAsync(),
            priorities = await context.Priorities.CountAsync(),
            statuses = await context.Statuses.CountAsync(),
            users = await context.Users.CountAsync(),
            tickets = await context.Tickets.CountAsync()
        };
        return Results.Ok(summary);
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error retrieving master data summary: {ex.Message}");
    }
});

app.MapGet("/api/master-data/active", async (TicketDbContext context) =>
{
    try
    {
        var activeData = new
        {
            issueTypes = await context.IssueTypes.ToListAsync(),
            branches = await context.Branches.Where(b => b.IsActive).ToListAsync(),
            priorities = await context.Priorities.ToListAsync(),
            statuses = await context.Statuses.Where(s => s.IsActive).ToListAsync(),
            users = await context.Users.Where(u => u.IsActive).ToListAsync()
        };
        return Results.Ok(activeData);
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error retrieving active master data: {ex.Message}");
    }
});

app.MapPost("/api/master-data/validate", async (MasterDataValidationRequest request, TicketDbContext context) =>
{
    try
    {
        var validationResults = new List<ValidationResult>();

        // Validate Issue Type
        if (request.IssueTypeId.HasValue)
        {
            var issueType = await context.IssueTypes.FindAsync(request.IssueTypeId.Value);
            if (issueType == null)
                validationResults.Add(new ValidationResult { Field = "IssueTypeId", IsValid = false, Message = "Invalid Issue Type ID" });
            else
                validationResults.Add(new ValidationResult { Field = "IssueTypeId", IsValid = true, Message = "Valid" });
        }

        // Validate Branch
        if (request.BranchId.HasValue)
        {
            var branch = await context.Branches.FindAsync(request.BranchId.Value);
            if (branch == null || !branch.IsActive)
                validationResults.Add(new ValidationResult { Field = "BranchId", IsValid = false, Message = "Invalid or inactive Branch ID" });
            else
                validationResults.Add(new ValidationResult { Field = "BranchId", IsValid = true, Message = "Valid" });
        }

        // Validate Priority
        if (request.PriorityId.HasValue)
        {
            var priority = await context.Priorities.FindAsync(request.PriorityId.Value);
            if (priority == null)
                validationResults.Add(new ValidationResult { Field = "PriorityId", IsValid = false, Message = "Invalid Priority ID" });
            else
                validationResults.Add(new ValidationResult { Field = "PriorityId", IsValid = true, Message = "Valid" });
        }

        // Validate Status
        if (request.StatusId.HasValue)
        {
            var status = await context.Statuses.FindAsync(request.StatusId.Value);
            if (status == null || !status.IsActive)
                validationResults.Add(new ValidationResult { Field = "StatusId", IsValid = false, Message = "Invalid or inactive Status ID" });
            else
                validationResults.Add(new ValidationResult { Field = "StatusId", IsValid = true, Message = "Valid" });
        }

        return Results.Ok(new { validations = validationResults, isValid = validationResults.All(v => v.IsValid) });
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error validating master data: {ex.Message}");
    }
});

// Authentication API Endpoints
app.MapPost("/api/auth/login", async (LoginRequest request, TicketDbContext context) =>
{
    try
    {
        Console.WriteLine($"Login attempt for username: {request.Username}");
        
        var user = await context.Users.FirstOrDefaultAsync(u => u.Username == request.Username);
        
        if (user == null)
        {
            Console.WriteLine($"User not found: {request.Username}");
            return Results.Unauthorized();
        }
        
        if (!user.IsActive)
        {
            Console.WriteLine($"User account is inactive: {request.Username}");
            return Results.Unauthorized();
        }
        
        // Simple password check (in production, use proper password hashing)
        if (user.Password != request.Password)
        {
            Console.WriteLine($"Invalid password for user: {request.Username}");
            return Results.Unauthorized();
        }
        
        Console.WriteLine($"Login successful for user: {request.Username}");
        
        // Return user info without password
        var userResponse = new
        {
            id = user.Id,
            username = user.Username,
            fullName = user.FullName,
            email = user.Email,
            role = user.Role,
            department = user.Department,
            phone = user.Phone,
            isActive = user.IsActive
        };
        
        return Results.Ok(userResponse);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Login error: {ex}");
        return Results.Problem($"Login failed: {ex.Message}");
    }
});

// User API Endpoints
app.MapGet("/api/users", async (TicketDbContext context) =>
{
    try
    {
        Console.WriteLine("Fetching users from database...");
        var users = await context.Users.ToListAsync();
        Console.WriteLine($"Found {users.Count} users");
        return Results.Ok(users);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error fetching users: {ex}");
        return Results.Problem($"Error fetching users: {ex.Message}");
    }
});

// Test database connection
app.MapGet("/api/test-db", async (TicketDbContext context) =>
{
    try
    {
        Console.WriteLine("Testing database connection...");
        var userCount = await context.Users.CountAsync();
        Console.WriteLine($"Database connection successful. User count: {userCount}");
        return Results.Ok(new { message = "Database connection successful", userCount = userCount });
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Database connection failed: {ex}");
        return Results.Problem($"Database connection failed: {ex.Message}");
    }
});

app.MapGet("/api/users/{id}", async (int id, TicketDbContext context) =>
{
    var user = await context.Users.FindAsync(id);
    return user != null ? Results.Ok(user) : Results.NotFound();
});

app.MapPost("/api/users", async (CreateUserRequest request, TicketDbContext context) =>
{
    try
    {
        Console.WriteLine($"Creating user with data: Username={request.Username}, Email={request.Email}, Role={request.Role}");
        
        // Create a simple user first
    var user = new User
    {
            Username = request.Username ?? "defaultuser",
            FullName = request.FullName ?? "Default User",
            Email = request.Email ?? "default@example.com",
            Role = request.Role ?? "user",
            Department = request.Department ?? "Default",
            Phone = request.Phone ?? string.Empty,
            Password = request.Password ?? "defaultpassword",
            IsActive = true
        };

        Console.WriteLine($"Adding user to context: {user.Username}");
    context.Users.Add(user);
        
        Console.WriteLine("Saving changes to database...");
    await context.SaveChangesAsync();
        Console.WriteLine($"User created successfully with ID: {user.Id}");

    return Results.Created($"/api/users/{user.Id}", user);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error creating user: {ex}");
        Console.WriteLine($"Inner exception: {ex.InnerException?.Message}");
        Console.WriteLine($"Stack trace: {ex.StackTrace}");
        return Results.Problem($"Error creating user: {ex.Message}");
    }
});

app.MapPut("/api/users/{id}", async (int id, UpdateUserRequest request, TicketDbContext context) =>
{
    var user = await context.Users.FindAsync(id);
    if (user == null) return Results.NotFound();

    user.Username = request.Username;
    user.FullName = request.FullName;
    user.Email = request.Email;
    user.Role = request.Role;
    user.Department = request.Department;
    user.Phone = request.Phone;
    user.Password = request.Password;
    user.IsActive = request.IsActive;

    await context.SaveChangesAsync();
    return Results.Ok(user);
});

app.MapDelete("/api/users/{id}", async (int id, TicketDbContext context) =>
{
    var user = await context.Users.FindAsync(id);
    if (user == null) return Results.NotFound();

    context.Users.Remove(user);
    await context.SaveChangesAsync();
    return Results.NoContent();
});

async Task<string> GenerateTicketNumber(TicketDbContext context)
{
    var lastTicket = await context.Tickets.OrderByDescending(t => t.Id).FirstOrDefaultAsync();
    var nextNumber = lastTicket?.Id + 1 ?? 1;
    return $"TK-{nextNumber:D6}";
}

app.Run();

// Models
public class Ticket
{
    public int Id { get; set; }
    public string TicketNumber { get; set; } = string.Empty;
    public string ReporterName { get; set; } = string.Empty;
    public string ContactNumber { get; set; } = string.Empty;
    public string Branch { get; set; } = string.Empty;
    public string IssueType { get; set; } = string.Empty;
    public string ReportedIssue { get; set; } = string.Empty;
    public string? Attachment { get; set; }  // JSON array of attachments (max 3) - uses existing DB column
    public DateTime DateOfTicket { get; set; }
    public DateTime TicketOpenTime { get; set; }
    public DateTime? WorkStartTime { get; set; }
    public DateTime? WorkEndTime { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Priority { get; set; } = "Low";
    public string AssignedTo { get; set; } = string.Empty;
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedDate { get; set; }
}

public class CreateTicketRequest
{
    public string ReporterName { get; set; } = string.Empty;
    public string ContactNumber { get; set; } = string.Empty;
    public string Branch { get; set; } = string.Empty;
    public string IssueType { get; set; } = string.Empty;
    public string ReportedIssue { get; set; } = string.Empty;
    public string? Attachments { get; set; }  // JSON string of attachments array (saved to Attachment column)
    public DateTime DateOfTicket { get; set; }
    public string Priority { get; set; } = "Low";
    public string CreatedBy { get; set; } = string.Empty;
}

public class UpdateTicketRequest
{
    public string ReporterName { get; set; } = string.Empty;
    public string ContactNumber { get; set; } = string.Empty;
    public string Branch { get; set; } = string.Empty;
    public string IssueType { get; set; } = string.Empty;
    public string ReportedIssue { get; set; } = string.Empty;
    public string? Attachments { get; set; }  // JSON string of attachments array
    public DateTime DateOfTicket { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public DateTime? WorkStartTime { get; set; }
    public DateTime? WorkEndTime { get; set; }
    public string AssignedTo { get; set; } = string.Empty;
}

public class IssueType
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

public class Branch
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string ContactNumber { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public class Priority
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int Level { get; set; } // 1=Low, 2=Medium, 3=High, 4=Critical
    public string Color { get; set; } = string.Empty;
}

public class Status
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty; // admin, user, technician
    public string Department { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public class CreateIssueTypeRequest
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

public class UpdateIssueTypeRequest
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

// Branch request/response models
public class CreateBranchRequest
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string ContactNumber { get; set; } = string.Empty;
}

public class UpdateBranchRequest
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string ContactNumber { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

// Priority request/response models
public class CreatePriorityRequest
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int Level { get; set; }
    public string Color { get; set; } = string.Empty;
}

public class UpdatePriorityRequest
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int Level { get; set; }
    public string Color { get; set; } = string.Empty;
}

// Status request/response models
public class CreateStatusRequest
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
}

public class UpdateStatusRequest
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

// Bulk request models
public class BulkCreateIssueTypeRequest
{
    public List<CreateIssueTypeRequest> Items { get; set; } = new();
}

public class BulkCreateBranchRequest
{
    public List<CreateBranchRequest> Items { get; set; } = new();
}

public class BulkCreatePriorityRequest
{
    public List<CreatePriorityRequest> Items { get; set; } = new();
}

public class BulkCreateStatusRequest
{
    public List<CreateStatusRequest> Items { get; set; } = new();
}

// Master data validation models
public class MasterDataValidationRequest
{
    public int? IssueTypeId { get; set; }
    public int? BranchId { get; set; }
    public int? PriorityId { get; set; }
    public int? StatusId { get; set; }
}

public class ValidationResult
{
    public string Field { get; set; } = string.Empty;
    public bool IsValid { get; set; }
    public string Message { get; set; } = string.Empty;
}

// Authentication request/response models
public class LoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

// User request/response models
public class CreateUserRequest
{
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class UpdateUserRequest
{
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public class TicketDbContext : DbContext
{
    public TicketDbContext(DbContextOptions<TicketDbContext> options) : base(options) { }
    public DbSet<Ticket> Tickets { get; set; }
    public DbSet<IssueType> IssueTypes { get; set; }
    public DbSet<Branch> Branches { get; set; }
    public DbSet<Priority> Priorities { get; set; }
    public DbSet<Status> Statuses { get; set; }
    public DbSet<User> Users { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
    }
}

// RPC Database Context for branch data
public class RpcDbContext : DbContext
{
    public RpcDbContext(DbContextOptions<RpcDbContext> options) : base(options) { }
    public DbSet<StoreMaster> StoresMaster_Main { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // Map to the correct table name (dbo schema by default)
        modelBuilder.Entity<StoreMaster>()
            .ToTable("StoresMaster_Main")
            .HasKey(s => s.No);  // Use 'No' as primary key
    }
}

// Model for StoresMaster_Main table
public class StoreMaster
{
    [Key]
    public int No { get; set; }  // Primary key column
    public int Year { get; set; }
    public string? StoreFormat { get; set; }
    public string? StoreCode { get; set; }
    public string StoreName { get; set; } = string.Empty;  // This is what we need!
    public string? StoreType { get; set; }
    public string? StoreGroup { get; set; }
    public string? Province { get; set; }
    public string? Status { get; set; }
}

// RPC Website Database Context for user data
public class RpcWebsiteDbContext : DbContext
{
    public RpcWebsiteDbContext(DbContextOptions<RpcWebsiteDbContext> options) : base(options) { }
    public DbSet<RpcUser> Users { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // Map to the correct table name (dbo schema by default)
        modelBuilder.Entity<RpcUser>()
            .ToTable("Users", "dbo")
            .HasNoKey(); // Since the table doesn't have a primary key
    }
}

// Model for RpcWebsite Users table
public class RpcUser
{
    public string Username { get; set; } = string.Empty;
    public string BU { get; set; } = string.Empty;
    public string LoginType { get; set; } = string.Empty;
    public string PasswordLogin { get; set; } = string.Empty;
    public string Level { get; set; } = string.Empty;
    public string Empid { get; set; } = string.Empty;
    public string Job_Grade { get; set; } = string.Empty;
    public string Workplaceid { get; set; } = string.Empty;
    public string Name_EN { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public string HQ_Status { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string Location_Code { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public string Department_Company { get; set; } = string.Empty;
    public string MgrEmpid { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string RocksTokenPoint { get; set; } = string.Empty;
    public string EmailNotification { get; set; } = string.Empty;
    public string Enable_Status { get; set; } = string.Empty;
    public string DOB { get; set; } = string.Empty;
    public string StartDate { get; set; } = string.Empty;
    public string ResignDate { get; set; } = string.Empty;
    public string Lastlogin { get; set; } = string.Empty;
    public string ShareToken { get; set; } = string.Empty;
    public string SubDepartment_Company { get; set; } = string.Empty;
    public string DeptCode { get; set; } = string.Empty;
    public string SubDept { get; set; } = string.Empty;
}

// Microsoft authentication request model
public class MicrosoftAuthRequest
{
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
}
