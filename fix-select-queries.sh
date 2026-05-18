#!/bin/bash

# Script pour remplacer tous les SELECT * par des colonnes explicites
# Cela réduit la charge réseau et améliore les performances

cd /vercel/share/v0-project/src

# Fonction pour remplacer SELECT * selon le contexte
fix_selects() {
  # 1. Restaurants table
  find . -name "*.ts" -o -name "*.tsx" | xargs sed -i "s/\.select('\\*')\(.*restaurants\)/\.select('id,name,slug,owner_id,is_open,avg_rating,total_reviews,city,address,phone,email,description,image_url,created_at')\1/g"
  
  # 2. Orders table
  find . -name "*.ts" -o -name "*.tsx" | xargs sed -i "s/\.from('orders')\.select('\\*')/\.from('orders')\.select('id,order_number,status,type,total_amount,delivery_address,notes,created_at,updated_at,customer_id,restaurant_id')/g"
  
  # 3. Events table
  find . -name "*.ts" -o -name "*.tsx" | xargs sed -i "s/\.from('events')\.select('\\*')/\.from('events')\.select('id,title,description,start_time,end_time,location,image_url,is_published,total_capacity,restaurant_id')/g"
  
  # 4. Items (menu) table
  find . -name "*.ts" -o -name "*.tsx" | xargs sed -i "s/\.from('items')\.select('\\*')/\.from('items')\.select('id,name,description,price,category_id,restaurant_id,is_available,image_url')/g"
  
  # 5. Categories table
  find . -name "*.ts" -o -name "*.tsx" | xargs sed -i "s/\.from('categories')\.select('\\*')/\.from('categories')\.select('id,name,sort_order,restaurant_id')/g"
  
  # 6. Profiles table
  find . -name "*.ts" -o -name "*.tsx" | xargs sed -i "s/\.from('profiles')\.select('\\*')/\.from('profiles')\.select('id,full_name,email,phone,role,restaurant_id,created_at')/g"
}

echo "Fixing SELECT * queries..."
fix_selects
echo "Done! SELECT * replaced with explicit columns."
