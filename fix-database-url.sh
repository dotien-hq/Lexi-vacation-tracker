#!/bin/bash

# Script to fix DATABASE_URL for serverless + PgBouncer configuration
# This addresses connection pool exhaustion in production

echo "🔍 Checking current DATABASE_URL configuration..."
echo ""

CURRENT_URL=$(grep "^DATABASE_URL=" .env | cut -d'=' -f2- | tr -d '"')

if [[ -z "$CURRENT_URL" ]]; then
    echo "❌ ERROR: DATABASE_URL not found in .env file"
    exit 1
fi

echo "Current DATABASE_URL:"
echo "$CURRENT_URL"
echo ""

# Check if using port 5432 (direct connection)
if [[ "$CURRENT_URL" == *":5432/"* ]]; then
    echo "⚠️  WARNING: Using port 5432 (direct connection, no pooling)"
    echo "   This causes connection pool exhaustion in serverless!"
    echo ""
    echo "🔧 Recommended fix:"
    echo "   1. Change port from 5432 to 6543"
    echo "   2. Add ?pgbouncer=true"
    echo "   3. Add &connection_limit=1 (for serverless)"
    echo "   4. Add &pool_timeout=10"
    echo ""

    # Generate fixed URL
    FIXED_URL=$(echo "$CURRENT_URL" | sed 's/:5432\//:6543\//')

    if [[ "$FIXED_URL" == *"?"* ]]; then
        FIXED_URL="${FIXED_URL}&pgbouncer=true&connection_limit=1&pool_timeout=10"
    else
        FIXED_URL="${FIXED_URL}?pgbouncer=true&connection_limit=1&pool_timeout=10"
    fi

    echo "Suggested DATABASE_URL:"
    echo "$FIXED_URL"
    echo ""
    echo "📝 To apply this fix:"
    echo "   1. Update your .env file with the corrected DATABASE_URL above"
    echo "   2. Restart your development server"
    echo "   3. Deploy to production with the updated configuration"

elif [[ "$CURRENT_URL" == *":6543/"* ]]; then
    echo "✅ Using port 6543 (pooled connection)"

    # Check for required parameters
    MISSING=()
    [[ "$CURRENT_URL" != *"pgbouncer=true"* ]] && MISSING+=("pgbouncer=true")
    [[ "$CURRENT_URL" != *"connection_limit="* ]] && MISSING+=("connection_limit=1")
    [[ "$CURRENT_URL" != *"pool_timeout="* ]] && MISSING+=("pool_timeout=10")

    if [ ${#MISSING[@]} -gt 0 ]; then
        echo "⚠️  Missing parameters: ${MISSING[*]}"
        echo ""

        FIXED_URL="$CURRENT_URL"
        for param in "${MISSING[@]}"; do
            if [[ "$FIXED_URL" == *"?"* ]]; then
                FIXED_URL="${FIXED_URL}&${param}"
            else
                FIXED_URL="${FIXED_URL}?${param}"
            fi
        done

        echo "Suggested DATABASE_URL:"
        echo "$FIXED_URL"
    else
        echo "✅ All required parameters present"
        echo ""
        echo "Configuration looks good! If you're still experiencing connection"
        echo "pool timeouts, check your deployment platform's connection limits."
    fi
else
    echo "⚠️  WARNING: Unexpected port in DATABASE_URL"
    echo "   Expected port 6543 (pooled) or 5432 (direct)"
fi

echo ""
echo "📚 Learn more:"
echo "   - Supabase Connection Pooling: https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler"
echo "   - Prisma Connection Pool: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool"
