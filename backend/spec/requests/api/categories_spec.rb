require 'rails_helper'

RSpec.describe "Api::Categories", type: :request do
  describe "GET /api/categories" do
    let!(:food) { Category.create!(name: "Food") }
    let!(:transport) { Category.create!(name: "Transport") }
    let!(:supplies) { Category.create!(name: "Supplies") }

    it "returns all categories" do
      get "/api/categories"

      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json.length).to eq(3)
      expect(json.map { |c| c["name"] }).to include("Food", "Transport", "Supplies")
    end

    it "returns categories in alphabetical order" do
      get "/api/categories"

      json = JSON.parse(response.body)
      expect(json.map { |c| c["name"] }).to eq([ "Food", "Supplies", "Transport" ])
    end
  end

  describe "POST /api/categories" do
    it "creates a normalized category" do
      expect {
        post "/api/categories", params: { category: { name: "  Subscriptions  " } }, as: :json
      }.to change(Category, :count).by(1)

      expect(response).to have_http_status(:created)
      expect(JSON.parse(response.body)).to include("name" => "Subscriptions")
    end

    it "returns validation errors without creating a category" do
      Category.create!(name: "Subscriptions")

      expect {
        post "/api/categories", params: { category: { name: "subscriptions" } }, as: :json
      }.not_to change(Category, :count)

      expect(response).to have_http_status(422)
      expect(JSON.parse(response.body)["errors"]).to include("Name has already been taken")
    end

    it "rejects a malformed request" do
      post "/api/categories", params: {}, as: :json

      expect(response).to have_http_status(:bad_request)
    end

    it "handles a concurrent uniqueness conflict" do
      allow_any_instance_of(Category).to receive(:save).and_raise(ActiveRecord::RecordNotUnique)

      post "/api/categories", params: { category: { name: "Subscriptions" } }, as: :json

      expect(response).to have_http_status(422)
      expect(JSON.parse(response.body)["errors"]).to eq([ "Name has already been taken" ])
    end
  end
end
